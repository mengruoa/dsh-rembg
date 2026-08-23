import { createReadStream, createWriteStream, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { mkdir, rm, stat } from 'node:fs/promises'
import { finished } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { spawn } from 'node:child_process'
import { basename, dirname, extname, join } from 'node:path'
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
})
const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url))
const HF_MIRROR_MODELS = new Set(['u2net', 'u2netp', 'u2net_cloth_seg', 'u2net_human_seg', 'isnet-anime', 'isnet-general-use', 'silueta'])
const MODELS = [
  ['u2net', '通用主体分割', '8d10d2f3bb75ae3b6d527c77944fc5e7dcd94b29809d47a739a7a728a912b491'],
  ['u2netp', '轻量快速通用分割', '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8'],
  ['u2net_cloth_seg', '服装分割', '6d2cbc27bfbdc989e1fd325656d65902ecc6a3ccbe94b2d3655ec114efcb128e'],
  ['u2net_human_seg', '人体分割', '01eb6a29a5c4d8edb30b56adad9bb3a2a0535338e480724a213e0acfd2d1c73c'],
  ['isnet-anime', '动漫人物', 'f15622d853e8260172812b657053460e20806f04b9e05147d49af7bed31a6e99'],
  ['isnet-general-use', '通用高质量分割', '60920e99c45464f2ba57bee2ad08c919a52bbf852739e96947fbb4358c0d964a'],
  ['silueta', '轻量移动端分割', '75da6c8d2f8096ec743d071951be73b4a8bc7b3e51d9a6625d63644f90ffeedb'],
]
const MODEL_MAP = new Map(MODELS.map(([id, label, sha256]) => [id, { id, label, sha256 }]))

export function apply(ctx, config) {
  const root = config.installDir || PLUGIN_DIR
  const python = join(root, '.venv', 'bin', 'python')
  const worker = join(root, 'rembg_gpu_worker.py')
  const installer = join(root, 'install.sh')
  const modelDir = join(root, '.u2net', 'models', 'u2net')
  const settings = ctx.settings.register(REMBG_GPU_SETTINGS_NAMESPACE, Config, { base: config, applies: 'live' })
  let installPromise = null; let installDone = false; let installError = null
  const modelJobs = new Map()

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
  async function sha256(path) {
    const hash = createHash('sha256')
    return new Promise((resolve, reject) => {
      const stream = createReadStream(path)
      stream.on('data', chunk => hash.update(chunk))
      stream.on('end', () => resolve(hash.digest('hex')))
      stream.on('error', reject)
    })
  }
  function modelPath(id) {
    return join(root, '.u2net', 'models', id, `${id}.onnx`)
  }
  async function modelState(model) {
    const path = modelPath(model.id)
    if (modelJobs.has(model.id)) return { ...model, status: 'installing' }
    if (!existsSync(path)) return { ...model, status: 'not-installed' }
    try {
      const actual = await sha256(path)
      return { ...model, status: actual === model.sha256 ? 'installed' : 'invalid', size: (await stat(path)).size }
    } catch {
      return { ...model, status: 'invalid' }
    }
  }
  async function models() {
    return Promise.all([...MODEL_MAP.values()].map(modelState))
  }
  function installStatus() {
    if (installPromise) return 'installing'
    if (installDone || existsSync(python)) return 'installed'
    return 'not-installed'
  }
  async function installModel(id, source = 'hf') {
    const model = MODEL_MAP.get(id); if (!model) throw new Error(`不支持的模型：${id}`); if (modelJobs.has(id)) return modelJobs.get(id)
    const job = (async () => {
      const target = modelPath(id)
      const temp = `${target}.part`
      await mkdir(dirname(target), { recursive: true })
      await rm(temp, { force: true }); const url = source === 'hf' && HF_MIRROR_MODELS.has(id) ? `https://hf-mirror.com/tomjackson2023/rembg/resolve/main/${id}.onnx?download=true` : `https://github.com/danielgatis/rembg/releases/download/v0.0.0/${id}.onnx`
      const response = await fetch(url); if (!response.ok || !response.body) throw new Error(`下载 ${id} 失败：HTTP ${response.status}`)
      await finished(Readable.fromWeb(response.body).pipe(createWriteStream(temp)))
      const actual = await sha256(temp); if (actual !== model.sha256) { await rm(temp, { force: true }); throw new Error(`${id} SHA256 校验失败`) }
      await rm(target, { force: true })
      const { rename } = await import('node:fs/promises')
      await rename(temp, target)
    })().finally(() => modelJobs.delete(id)); modelJobs.set(id, job); return job
  }
  async function ensureInstalled(overrides = settings.get()) {
    if (installDone) return
    if (!installPromise) installPromise = (async () => {
      installError = null
      const check = await gpuCheck()
      if (!check.ok) throw new Error(`GPU 环境不满足，无法初始化：${check.reason}`)
      const pipIndexUrl = overrides.pipIndexUrl || 'https://mirrors.aliyun.com/pypi/simple/'
      if (!['https://mirrors.aliyun.com/pypi/simple/', 'https://pypi.org/simple'].includes(pipIndexUrl)) throw new Error('只允许阿里云或官方 PyPI 镜像')
      await run('bash', [installer], overrides.timeoutMs || config.timeoutMs, { ...process.env, PIP_INDEX_URL: pipIndexUrl })
      installDone = true
    })().catch(error => { installError = error.message; throw error }).finally(() => { installPromise = null })
    return installPromise
  }
  function snapshot(webCtx) { const descriptor = webCtx.settings.describe().find(row => row.ns === REMBG_GPU_SETTINGS_NAMESPACE); return { writable: webCtx.settings.writable, installation: { status: installStatus(), error: installError }, settings: { value: descriptor?.value ?? {}, revision: descriptor?.revision ?? 0, ...(descriptor?.base === undefined ? {} : { base: descriptor.base }), ...(descriptor?.user === undefined ? {} : { user: descriptor.user }) } } }
  function json(res, status, value) { const body = JSON.stringify(value); res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }); res.end(body) }
  function body(req) { return new Promise((resolve, reject) => { const chunks = []; req.on('data', x => chunks.push(x)); req.on('end', () => resolve(Buffer.concat(chunks).toString())); req.on('error', reject) }) }
  async function route(webCtx, req, res) { try {
    if (req.method === 'GET') return json(res, 200, { ok: true, value: { ...snapshot(webCtx), gpu: await gpuCheck(), models: await models() } })
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: { message: 'method not allowed' } }); const data = JSON.parse(await body(req))
    if (data.action === 'mutate') { if (!webCtx.settings.writable) throw new Error('settings provider is read-only'); await webCtx.settings.mutate(REMBG_GPU_SETTINGS_NAMESPACE, data.ops || [], data.expectedRevision) }
    else if (data.action === 'initialize') await ensureInstalled(settings.get())
    else if (data.action === 'install-model') await installModel(data.model, data.source)
    else if (data.action === 'delete-model') { const model = MODEL_MAP.get(data.model); if (!model) throw new Error('不支持的模型'); await rm(modelPath(model.id), { force: true }) }
    else throw new Error('unknown action')
    return json(res, 200, { ok: true, value: { ...snapshot(webCtx), gpu: await gpuCheck(), models: await models() } })
  } catch (error) { return json(res, 400, { ok: false, error: { message: error.message } }) } }
  ctx.inject(['webServer'], webCtx => webCtx.effect(() => webCtx.webServer.register({ kind: 'exact', path: '/_dsh/rembg-gpu/settings', handler: (req, res) => route(webCtx, req, res) }), 'rembg-gpu: settings route'))
  ctx.tools.register(defineTool({
    name: 'rembg_gpu_models',
    description: 'List rembg GPU models that are installed and have passed SHA256 validation. Call this before choosing a model for rembg_gpu.',
    parameters: {},
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { installed_models: { type: 'array', required: true } } },
      render: (_args, value) => [{ type: 'text', text: `已安装 GPU 模型：${value.installed_models.join(', ') || '无'}` }],
    },
    async execute() {
      const available = await models()
      return { installed_models: available.filter(item => item.status === 'installed').map(item => item.id) }
    },
  }))
  ctx.tools.register(defineTool({
    name: 'rembg_gpu',
    description: 'Remove an image background with local NVIDIA CUDA rembg. Call rembg_gpu_models first to see installed models.',
    parameters: { path: { type: 'string', required: true, description: 'Absolute input image path.' }, image_path: { type: 'string', description: 'Compatibility alias for path.' }, model: { type: 'string', description: 'Installed rembg model name; omit to use the configured default.' } },
    output: { schema: { type: 'object', additionalProperties: false, properties: { output: { type: 'string', required: true }, input: { type: 'string', required: true }, model: { type: 'string', required: true }, width: { type: 'number' }, height: { type: 'number' } } }, render: (_args, value) => [{ type: 'text', text: `GPU 背景已移除：${value.output}（模型 ${value.model}）` }] },
    async execute(args, exec) { const current = settings.get(); if (current.autoInstall) await ensureInstalled(current); const model = args.model || current.model; const available = await models(); if (!available.some(item => item.id === model && item.status === 'installed')) throw new Error(`模型 ${model} 未安装或校验无效。请先调用 rembg_gpu_models 查看已安装模型。`); const input = typeof args.path === 'string' && args.path.trim() ? args.path : typeof args.image_path === 'string' && args.image_path.trim() ? args.image_path : null; if (!input) throw new Error('缺少输入图片路径：请提供绝对路径参数 path。'); const output = join(dirname(input), `${basename(input, extname(input))}_no_bg_gpu.png`); const result = await run(python, [worker, '--input', input, '--output', output, '--model', model], current.timeoutMs || config.timeoutMs, process.env, exec.signal); for (const line of result.stdout.split('\n').reverse()) { try { const value = JSON.parse(line); if (value.output) return value } catch {} } throw new Error('无法解析 GPU rembg 输出') },
  }))
}
