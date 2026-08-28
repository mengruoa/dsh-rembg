import { createReadStream, createWriteStream, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { mkdir, rm, stat } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { spawn } from 'node:child_process'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'rembg-gpu-tool'
export const inject = ['tools', 'settings']
export const REMBG_GPU_SETTINGS_NAMESPACE = settingsNamespace('rembg-gpu-tool')
export const Config = Schema.object({
  installDir: Schema.string(),
  model: Schema.string().default('u2net'),
  timeoutMs: Schema.number().default(900000),
  pipIndexUrl: Schema.string().default('https://mirrors.aliyun.com/pypi/simple/'),
  autoInstall: Schema.boolean().default(true),
  useGpu: Schema.boolean().default(true),
})
const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url))
const MODEL_CATALOG_PATH = join(PLUGIN_DIR, 'model.json')
const MODELS = JSON.parse(readFileSync(MODEL_CATALOG_PATH, 'utf8'))
const MODEL_MAP = new Map(MODELS.map(model => [model.id, model]))

export function apply(ctx, config) {
  const root = config.installDir || PLUGIN_DIR
  const python = join(root, '.venv', 'bin', 'python')
  const worker = join(root, 'rembg_gpu_worker.py')
  const gpuInstaller = join(root, 'install.sh')
  const cpuInstaller = join(root, 'install-cpu.sh')
  const modeFile = join(root, '.install-mode')
  const modelDir = join(root, '.u2net', 'models', 'u2net')
  const settings = ctx.settings.register(REMBG_GPU_SETTINGS_NAMESPACE, Config, { base: config, applies: 'live' })
  let installPromise = null; let installDone = false; let installError = null
  const modelJobs = new Map()
  function lastLogLine(logPath) {
    try {
      const content = readFileSync(logPath, 'utf8')
      const lines = content.trim().split('\n').filter(Boolean)
      return lines.length > 0 ? lines[lines.length - 1] : null
    } catch {
      return null
    }
  }
  const modelControllers = new Map()
  const modelProgress = new Map()
  const modelHashCache = new Map()
  const modelHashInflight = new Map()

  function run(cmd, args, timeoutMs, env = process.env, signal) {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env }); let stdout = ''; let stderr = ''; let settled = false
      const timer = setTimeout(() => { child.kill('SIGKILL'); finish(new Error(`${cmd} 超时`)) }, timeoutMs)
      const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); error ? reject(error) : resolve(value) }
      const abort = () => { child.kill('SIGTERM'); finish(new Error(`${cmd} 已取消`)) }
      if (signal) { if (signal.aborted) return abort(); signal.addEventListener('abort', abort, { once: true }) }
      child.stdout.on('data', data => { stdout += data }); child.stderr.on('data', data => { stderr += data }); child.on('error', finish)
      child.on('close', code => code === 0 ? finish(null, { stdout, stderr }) : finish(new Error(`${cmd} 退出码 ${code}：${(stderr || stdout).trim().slice(-500)}`)))
    })
  }
  async function gpuCheck() { try { const result = await run('nvidia-smi', ['-L'], 10000); return result.stdout.trim() ? { ok: true, reason: result.stdout.trim() } : { ok: false, reason: 'nvidia-smi 未列出可用 GPU。' } } catch (error) { return { ok: false, reason: `无法运行 nvidia-smi：${error.message}` } } }
  function getNvidiaLibPaths(base) { try { const sitePackages = join(base, '.venv', 'lib'); const pythonDirs = readdirSync(sitePackages).filter(d => d.startsWith('python')); if (pythonDirs.length === 0) return []; const nvidiaDir = join(sitePackages, pythonDirs[0], 'site-packages', 'nvidia'); if (!existsSync(nvidiaDir)) return []; return readdirSync(nvidiaDir).map(d => join(nvidiaDir, d, 'lib')).filter(d => { try { return existsSync(d) } catch { return false } }) } catch { return [] } }
  function pythonEnv(base) { const env = { ...process.env }; const nvidiaLibs = getNvidiaLibPaths(base); if (nvidiaLibs.length > 0) env.LD_LIBRARY_PATH = nvidiaLibs.join(':') + (process.env.LD_LIBRARY_PATH ? ':' + process.env.LD_LIBRARY_PATH : ''); return env }
  async function sha256(path) {
    const hash = createHash('sha256')
    return new Promise((resolve, reject) => {
      const stream = createReadStream(path)
      stream.on('data', chunk => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }
  async function sha256Cached(path, info) {
    const cached = modelHashCache.get(path)
    if (cached && cached.size === info.size && cached.mtimeMs === info.mtimeMs) return cached.sha256
    if (modelHashInflight.has(path)) return modelHashInflight.get(path)
    const promise = sha256(path).then(actual => {
      modelHashCache.set(path, { size: info.size, mtimeMs: info.mtimeMs, sha256: actual })
      return actual
    }).finally(() => { modelHashInflight.delete(path) })
    modelHashInflight.set(path, promise)
    return promise
  }
  function modelPath(id) {
    return join(root, '.u2net', 'models', id, `${id}.onnx`)
  }
  async function modelState(model) {
    const path = modelPath(model.id)
    if (modelJobs.has(model.id)) return { ...model, status: 'installing', progress: modelProgress.get(model.id) || null }
    if (!existsSync(path)) return { ...model, status: 'not-installed' }
    try {
      const info = await stat(path)
      const actual = await sha256Cached(path, info)
      return { ...model, status: actual === model.sha256 ? 'installed' : 'invalid', size: info.size }
    } catch {
      return { ...model, status: 'invalid' }
    }
  }
  async function models() {
    return Promise.all([...MODEL_MAP.values()].map(modelState))
  }
  function installedMode() {
    try { return readFileSync(modeFile, 'utf8').trim() } catch { return null }
  }
  function installStatus() {
    if (installPromise) return 'installing'
    const currentMode = installedMode()
    const expectedMode = settings.get().useGpu ? 'gpu' : 'cpu'
    // 环境未安装
    if (!installDone && !existsSync(python)) return 'not-installed'
    // GPU→CPU：GPU 环境自带 CPUExecutionProvider，无需重装
    if (currentMode === 'gpu' && expectedMode === 'cpu') return 'installed'
    // 相同模式
    if (currentMode === expectedMode) return 'installed'
    // CPU→GPU 或 无模式→GPU：需要重装
    return 'not-installed'
  }
  async function installModel(id) {
    const model = MODEL_MAP.get(id); if (!model) throw new Error(`不支持的模型：${id}`); if (modelJobs.has(id)) return modelJobs.get(id)
    const controller = new AbortController()
    const job = (async () => {
      const target = modelPath(id)
      const temp = `${target}.part`
      await mkdir(dirname(target), { recursive: true })
      await rm(temp, { force: true })
      const response = await fetch(model.downloadUrl, { signal: controller.signal }); if (!response.ok || !response.body) throw new Error(`下载 ${id} 失败：HTTP ${response.status}`)
      const total = Number(response.headers.get('content-length')) || model.size || 0
      let downloaded = 0
      const startedAt = Date.now()
      try {
        await pipeline(
          Readable.fromWeb(response.body),
          async function* (source) {
            for await (const chunk of source) {
              if (controller.signal.aborted) throw new Error('下载已停止')
              downloaded += chunk.length
              const elapsed = Math.max(1, Date.now() - startedAt)
              modelProgress.set(id, { downloaded, total, speed: downloaded * 1000 / elapsed })
              yield chunk
            }
          },
          createWriteStream(temp)
        )
      } catch (error) {
        await rm(temp, { force: true })
        throw error
      }
      const actual = await sha256(temp); if (actual !== model.sha256) { await rm(temp, { force: true }); throw new Error(`${id} SHA256 校验失败`) }
      await rm(target, { force: true })
      const { rename } = await import('node:fs/promises')
      await rename(temp, target)
      modelHashCache.delete(target)
    })().finally(async () => { modelJobs.delete(id); modelControllers.delete(id); modelProgress.delete(id); await rm(`${modelPath(id)}.part`, { force: true }) })
    modelJobs.set(id, job)
    modelControllers.set(id, controller)
    modelProgress.set(id, { downloaded: 0, total: model.size || 0, speed: 0 })
    return job
  }
  function stopModel(id) {
    if (!modelJobs.has(id)) throw new Error(`模型 ${id} 当前没有下载任务`)
    modelControllers.get(id)?.abort()
  }
  async function ensureInstalled(overrides = settings.get()) {
    const mode = overrides.useGpu ? 'gpu' : 'cpu'
    const currentMode = installedMode()
    // GPU→CPU 切换：GPU 环境内置 CPUExecutionProvider，仅更新模式标记，无需重装
    if (currentMode === 'gpu' && mode === 'cpu' && (installDone || existsSync(python))) {
      if (currentMode !== mode) writeFileSync(modeFile, 'cpu\n')
      return
    }
    // CPU→GPU 切换：需要重置环境重新安装
    if (currentMode === 'cpu' && mode === 'gpu' && (installDone || existsSync(python))) {
      installDone = false
      installError = null
    }
    if (installStatus() === 'installed') return
    if (!installPromise) installPromise = (async () => {
      installError = null
      if (mode === 'gpu') {
        const check = await gpuCheck()
        if (!check.ok) throw new Error(`GPU 环境不满足，无法初始化：${check.reason}`)
      }
      const pipIndexUrl = overrides.pipIndexUrl || 'https://mirrors.aliyun.com/pypi/simple/'
      if (!['https://mirrors.aliyun.com/pypi/simple/', 'https://pypi.org/simple'].includes(pipIndexUrl)) throw new Error('只允许阿里云或官方 PyPI 镜像')
      await run('bash', [mode === 'gpu' ? gpuInstaller : cpuInstaller], overrides.timeoutMs || config.timeoutMs, { ...process.env, PIP_INDEX_URL: pipIndexUrl })
      installDone = true
    })().catch(error => { installError = error.message; throw error }).finally(() => { installPromise = null })
    return installPromise
  }
  function snapshot(webCtx) { const descriptor = webCtx.settings.describe().find(row => row.ns === REMBG_GPU_SETTINGS_NAMESPACE); const mode = installedMode(); const status = installStatus(); const logPath = join(root, 'logs', settings.get().useGpu ? 'install.log' : 'install-cpu.log'); const installLog = status === 'installing' ? lastLogLine(logPath) : null; return { writable: webCtx.settings.writable, installation: { status, mode, error: installError, installLog }, settings: { value: descriptor?.value ?? {}, revision: descriptor?.revision ?? 0, ...(descriptor?.base === undefined ? {} : { base: descriptor.base }), ...(descriptor?.user === undefined ? {} : { user: descriptor.user }) } } }
  function json(res, status, value) { const body = JSON.stringify(value); res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }); res.end(body) }
  function body(req) { return new Promise((resolve, reject) => { const chunks = []; req.on('data', x => chunks.push(x)); req.on('end', () => resolve(Buffer.concat(chunks).toString())); req.on('error', reject) }) }
  async function route(webCtx, req, res) { try {
    if (req.method === 'GET') return json(res, 200, { ok: true, value: { ...snapshot(webCtx), gpu: await gpuCheck(), models: await models() } })
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: { message: 'method not allowed' } }); const data = JSON.parse(await body(req))
    if (data.action === 'mutate') { if (!webCtx.settings.writable) throw new Error('settings provider is read-only'); await webCtx.settings.mutate(REMBG_GPU_SETTINGS_NAMESPACE, data.ops || [], data.expectedRevision) }
    else if (data.action === 'initialize') await ensureInstalled(settings.get())
    else if (data.action === 'install-model') { installModel(data.model).catch(() => {}) }
    else if (data.action === 'stop-model') stopModel(data.model)
    else if (data.action === 'delete-model') { const model = MODEL_MAP.get(data.model); if (!model) throw new Error('不支持的模型'); const delPath = modelPath(model.id); await rm(delPath, { force: true }); modelHashCache.delete(delPath) }
    else throw new Error('unknown action')
    return json(res, 200, { ok: true, value: { ...snapshot(webCtx), gpu: await gpuCheck(), models: await models() } })
  } catch (error) { return json(res, 400, { ok: false, error: { message: error.message } }) } }
  ctx.inject(['webServer'], webCtx => webCtx.effect(() => webCtx.webServer.register({ kind: 'exact', path: '/_dsh/rembg-gpu/settings', handler: (req, res) => route(webCtx, req, res) }), 'rembg-gpu: settings route'))
  ctx.tools.register(defineTool({
    name: 'rembg_models',
    description: 'List rembg models that are installed and have passed SHA256 validation. Call this before choosing a model for rembg.',
    parameters: {},
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { installed_models: { type: 'array', required: true } } },
      render: (_args, value) => [{ type: 'text', text: `已安装模型：${value.installed_models.join(', ') || '无'}` }],
    },
    async execute() {
      const available = await models()
      return { installed_models: available.filter(item => item.status === 'installed').map(item => item.id) }
    },
  }))
  ctx.tools.register(defineTool({
    name: 'rembg',
    description: 'Remove an image background with local rembg. Call rembg_models first to see installed models.',
    parameters: { path: { type: 'string', required: true, description: 'Absolute input image path.' }, model: { type: 'string', description: 'Installed rembg model name; omit to use the configured default.' } },
    output: { schema: { type: 'object', additionalProperties: false, properties: { output: { type: 'string', required: true }, input: { type: 'string', required: true }, model: { type: 'string', required: true }, width: { type: 'number' }, height: { type: 'number' } } }, render: (_args, value) => [{ type: 'text', text: `图片背景已移除：${value.output}（模型 ${value.model}）` }] },
    async execute(args, exec) { const current = settings.get(); if (current.autoInstall) await ensureInstalled(current); const model = args.model || current.model; const available = await models(); if (!available.some(item => item.id === model && item.status === 'installed')) throw new Error(`模型 ${model} 未安装或校验无效。请先调用 rembg_models 查看已安装模型。`); const input = typeof args.path === 'string' && args.path.trim() ? args.path : typeof args.image_path === 'string' && args.image_path.trim() ? args.image_path : null; if (!input) throw new Error('缺少输入图片路径：请提供绝对路径参数 path。'); const workspace = exec.agent?.session.header.cwd || process.cwd(); const outputDir = join(workspace, '.rembg-tmp'); await mkdir(outputDir, { recursive: true }); const output = join(outputDir, `${randomUUID()}.png`); const result = await run(python, [worker, '--input', input, '--output', output, '--model', model, ...(current.useGpu ? [] : ['--cpu'])], current.timeoutMs || config.timeoutMs, pythonEnv(root), exec.signal); for (const line of result.stdout.split('\n').reverse()) { try { const value = JSON.parse(line); if (value.output) return value } catch {} } throw new Error('无法解析rembg 输出') },
  }))
}
