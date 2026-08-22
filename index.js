import { existsSync } from 'node:fs'
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
  pipIndexUrl: Schema.string().default('https://pypi.tuna.tsinghua.edu.cn/simple'),
  ghMirror: Schema.string().default('https://ghfast.top/'),
  autoInstall: Schema.boolean().default(true),
})
const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url))

export function apply(ctx, config) {
  const root = config.installDir || PLUGIN_DIR
  const python = join(root, '.venv', 'bin', 'python')
  const worker = join(root, 'rembg_gpu_worker.py')
  const installer = join(root, 'install.sh')
  const settings = ctx.settings.register(REMBG_GPU_SETTINGS_NAMESPACE, Config, { base: config, applies: 'live' })
  let installPromise = null
  let installDone = false
  let installError = null

  function run(cmd, args, timeoutMs, env = process.env) {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env })
      let stdout = ''; let stderr = ''; let settled = false
      const timer = setTimeout(() => { child.kill('SIGKILL'); finish(new Error(`${cmd} 超时`)) }, timeoutMs)
      const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(value) }
      child.stdout.on('data', data => { stdout += data })
      child.stderr.on('data', data => { stderr += data })
      child.on('error', finish)
      child.on('close', code => code === 0 ? finish(null, { stdout, stderr }) : finish(new Error(`${cmd} 退出码 ${code}：${(stderr || stdout).trim().slice(-500)}`)))
    })
  }

  async function gpuCheck() {
    try {
      const result = await run('nvidia-smi', ['-L'], 10000)
      if (!result.stdout.trim()) return { ok: false, reason: 'nvidia-smi 未列出可用 GPU。' }
      return { ok: true, reason: result.stdout.trim() }
    } catch (error) { return { ok: false, reason: `无法运行 nvidia-smi：${error.message}` } }
  }

  function installStatus() {
    if (installPromise) return 'installing'
    if (installDone || (existsSync(join(root, '.venv', 'bin', 'python')) && existsSync(join(root, '.u2net', 'models', 'u2net', 'u2net.onnx')))) return 'installed'
    return 'not-installed'
  }
  function snapshot(webCtx) {
    const descriptor = webCtx.settings.describe().find(row => row.ns === REMBG_GPU_SETTINGS_NAMESPACE)
    return { writable: webCtx.settings.writable, installation: { status: installStatus(), error: installError }, settings: { value: descriptor?.value ?? {}, revision: descriptor?.revision ?? 0, ...(descriptor?.base === undefined ? {} : { base: descriptor.base }), ...(descriptor?.user === undefined ? {} : { user: descriptor.user }) } }
  }
  function json(res, status, value) { const body = JSON.stringify(value); res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }); res.end(body) }
  function body(req) { return new Promise((resolve, reject) => { const chunks = []; req.on('data', x => chunks.push(x)); req.on('end', () => resolve(Buffer.concat(chunks).toString())); req.on('error', reject) }) }

  async function ensureInstalled(overrides = settings.get()) {
    if (installDone) return
    if (!installPromise) {
      installPromise = (async () => {
        installError = null
        const check = await gpuCheck()
        if (!check.ok) throw new Error(`GPU 环境不满足，无法初始化：${check.reason}`)
        await run('bash', [installer], overrides.timeoutMs || config.timeoutMs, { ...process.env, PIP_INDEX_URL: overrides.pipIndexUrl || '', GH_MIRROR: overrides.ghMirror || '' })
        installDone = true
      })().catch(error => { installError = error.message; throw error }).finally(() => { installPromise = null })
    }
    return installPromise
  }

  async function route(webCtx, req, res) {
    try {
      if (req.method === 'GET') { const check = await gpuCheck(); return json(res, 200, { ok: true, value: { ...snapshot(webCtx), gpu: check } }) }
      if (req.method !== 'POST') return json(res, 405, { ok: false, error: { message: 'method not allowed' } })
      const data = JSON.parse(await body(req))
      if (data.action === 'mutate') { if (!webCtx.settings.writable) throw new Error('settings provider is read-only'); await webCtx.settings.mutate(REMBG_GPU_SETTINGS_NAMESPACE, data.ops || [], data.expectedRevision); return json(res, 200, { ok: true, value: snapshot(webCtx) }) }
      if (data.action === 'initialize') { await ensureInstalled(settings.get()); return json(res, 200, { ok: true, value: snapshot(webCtx) }) }
      return json(res, 400, { ok: false, error: { message: 'unknown action' } })
    } catch (error) { return json(res, 400, { ok: false, error: { message: error.message } }) }
  }
  ctx.inject(['webServer'], webCtx => webCtx.effect(() => webCtx.webServer.register({ kind: 'exact', path: '/_dsh/rembg-gpu/settings', handler: (req, res) => route(webCtx, req, res) }), 'rembg-gpu: settings route'))

  ctx.tools.register(defineTool({
    name: 'rembg_gpu', description: 'Remove an image background with the local NVIDIA CUDA rembg GPU environment.',
    parameters: { path: { type: 'string', required: true, description: 'Absolute input image path.' }, model: { type: 'string', description: 'rembg model name.' } },
    output: { schema: { type: 'object', additionalProperties: false, properties: { output: { type: 'string', required: true }, input: { type: 'string', required: true }, model: { type: 'string', required: true }, width: { type: 'number' }, height: { type: 'number' } } }, render: (_args, value) => [{ type: 'text', text: `GPU 背景已移除：${value.output}（${value.width}×${value.height}，模型 ${value.model}）` }] },
    async execute(args, exec) {
      const current = settings.get(); if (current.autoInstall) await ensureInstalled(current)
      const input = args.path; const output = join(dirname(input), `${basename(input, extname(input))}_no_bg_gpu.png`)
      const result = await run(python, [worker, '--input', input, '--output', output, '--model', args.model || current.model], current.timeoutMs || config.timeoutMs, process.env)
      for (const line of result.stdout.split('\n').reverse()) { try { const value = JSON.parse(line); if (value.output) return value } catch {} }
      throw new Error('无法解析 GPU rembg 输出')
    },
  }))
}
