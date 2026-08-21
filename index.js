// rembg-tool —— 为模型提供「移除图像背景」工具的 DSH 插件。
//
// 首次调用 rembg 工具时，若插件目录内尚未安装 rembg，会自动执行 install.sh
// 在插件目录（installDir，默认 = 本文件所在目录）内完成：
//   .venv（rembg[cpu]）+ .u2net（u2net.onnx，MD5 校验）
// 之后每次调用都复用该环境。全流程只写插件目录，不触碰全局 Python。
//
// 说明：使用纯 ESM JavaScript 以便零构建直接 `--patch` 加载，也便于打成
// npm bundle；如需类型提示可改写为 TypeScript（见 README）。

import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { basename, dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'rembg-tool'
export const inject = ['tools', 'settings']

export const REMBG_SETTINGS_NAMESPACE = settingsNamespace('rembg-tool')

export const Config = Schema.object({
  // 插件自装目录（venv + 模型 + 日志都放这里）。缺省 = 本文件所在目录。
  installDir: Schema.string(),
  // 默认模型名；单次调用仍可用参数覆盖。
  model: Schema.string().default('u2net'),
  // 单次调用（含首次安装）的总体超时。首次安装较慢，建议给足。
  timeoutMs: Schema.number().default(600000),
  // pip 镜像；留空时由 install.sh 使用默认镜像。
  pipIndexUrl: Schema.string().default('https://pypi.tuna.tsinghua.edu.cn/simple'),
  // GitHub 下载加速前缀；留空表示直连。
  ghMirror: Schema.string().default('https://ghfast.top/'),
  // 首次调用工具时自动安装；关闭则要求先在设置页初始化。
  autoInstall: Schema.boolean().default(true),
})

const PLUGIN_DIR = dirname(fileURLToPath(import.meta.url))

export function apply(ctx, config) {
  const root = config.installDir || PLUGIN_DIR
  const python = join(root, '.venv', 'bin', 'python')
  const worker = join(root, 'rembg_worker.py')
  const installer = join(root, 'install.sh')

  const settings = ctx.settings.register(REMBG_SETTINGS_NAMESPACE, Config, {
    base: config,
    applies: 'live',
  })

  function settingsSnapshot(webCtx) {
    const descriptor = webCtx.settings.describe().find(row => row.ns === REMBG_SETTINGS_NAMESPACE)
    return {
      writable: webCtx.settings.writable,
      installation: {
        status: installStatus(),
        error: installError,
      },
      settings: {
        value: descriptor?.value ?? {},
        revision: descriptor?.revision ?? 0,
        ...(descriptor?.base === undefined ? {} : { base: descriptor.base }),
        ...(descriptor?.user === undefined ? {} : { user: descriptor.user }),
      },
    }
  }

  function sendJson(res, status, payload) {
    const body = JSON.stringify(payload)
    res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) })
    res.end(body)
  }

  function collectBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = []
      req.on('data', chunk => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', reject)
    })
  }

  async function handleSettingsRequest(webCtx, req, res) {
    try {
      if (req.method === 'GET') return sendJson(res, 200, { ok: true, value: settingsSnapshot(webCtx) })
      if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: { message: 'method not allowed' } })
      const body = JSON.parse(await collectBody(req))
      if (body.action === 'mutate') {
        if (!webCtx.settings.writable) throw new Error('settings provider is read-only')
        await webCtx.settings.mutate(REMBG_SETTINGS_NAMESPACE, Array.isArray(body.ops) ? body.ops : [], body.expectedRevision)
        return sendJson(res, 200, { ok: true, value: settingsSnapshot(webCtx) })
      }
      if (body.action === 'initialize') {
        const current = settings.get()
        await ensureInstalled(current)
        return sendJson(res, 200, { ok: true, value: { ...settingsSnapshot(webCtx), initialized: true } })
      }
      sendJson(res, 400, { ok: false, error: { message: 'unknown action' } })
    } catch (err) {
      sendJson(res, 400, { ok: false, error: { message: String(err?.message ?? err) } })
    }
  }

  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(() => webCtx.webServer.register({
      kind: 'exact',
      path: '/_dsh/rembg/settings',
      handler: (req, res) => handleSettingsRequest(webCtx, req, res),
    }), 'rembg-tool: settings route')
  })

  let installPromise = null
  let installDone = false
  let installError = null

  function installStatus() {
    if (installPromise) return 'installing'
    if (installDone || (existsSync(join(root, '.venv', 'bin', 'python')) && existsSync(join(root, '.u2net', 'models', 'u2net', 'u2net.onnx')))) return 'installed'
    return 'not-installed'
  }

  // 运行一个子进程，捕获 stdout/stderr，支持超时与 exec.signal 取消。
  function runCommand(cmd, args, { signal, timeoutMs, env }) {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env })
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (d) => { stdout += d })
      child.stderr.on('data', (d) => { stderr += d })

      let settled = false
      const finish = (err, value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        err ? reject(err) : resolve(value)
      }

      const timer = setTimeout(() => {
        child.kill('SIGKILL')
        finish(new Error(`${cmd} 超时（${timeoutMs}ms）`))
      }, timeoutMs)

      const onAbort = () => {
        child.kill('SIGTERM')
        finish(new Error(`${cmd} 已取消`))
      }
      if (signal) {
        if (signal.aborted) return onAbort()
        signal.addEventListener('abort', onAbort, { once: true })
      }

      child.on('error', (err) => finish(err))
      child.on('close', (code) => {
        if (code === 0) return finish(null, { stdout, stderr })
        const parsed = parseError(stderr)
        finish(new Error(`${cmd} 退出码 ${code}：${(parsed || stderr || stdout).trim()}`))
      })
    })
  }

  // 从 stderr 里尽量捞出 worker 打印的 {"error": "..."}，否则返回 null。
  function parseError(stderr) {
    for (const line of stderr.split('\n').reverse()) {
      const t = line.trim()
      if (t.startsWith('{')) {
        try { const o = JSON.parse(t); if (o.error) return o.error } catch {}
      }
    }
    return null
  }

  // 从 stdout 里捞出 worker 最后打印的 JSON 结果（含 output 字段）。
  function parseResult(stdout) {
    for (const line of stdout.split('\n').reverse()) {
      const t = line.trim()
      if (t.startsWith('{')) {
        try { const o = JSON.parse(t); if (o.output) return o } catch {}
      }
    }
    throw new Error(`无法解析 rembg 输出：${stdout.trim().slice(-500)}`)
  }

  // 首次使用才安装；install.sh 幂等，已就绪会立即返回。用单个 Promise 避免并发重复安装。
  async function ensureInstalled(overrides = settings.get()) {
    if (installDone) return
    if (!installPromise) {
      installPromise = (async () => {
        installError = null
        console.log(`[rembg] 正在 ${root} 安装环境（详见 logs/install.log）…`)
        await runCommand('bash', [installer], {
          signal: undefined,
          timeoutMs: overrides.timeoutMs || config.timeoutMs,
          env: {
            ...process.env,
            PIP_INDEX_URL: overrides.pipIndexUrl || '',
            GH_MIRROR: overrides.ghMirror || '',
          },
        })
        installDone = true
        installError = null
        console.log('[rembg] 环境就绪')
      })().catch((error) => {
        installError = String(error?.message ?? error)
        throw error
      }).finally(() => { installPromise = null })
    }
    await installPromise
  }

  ctx.tools.register(defineTool({
    name: 'rembg',
    description:
      'Remove the background from an image (PNG/JPEG/WebP) and save a transparent-background PNG next to it. Returns the output path and dimensions.',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path of the input image file.',
      },
      model: {
        type: 'string',
        description: 'rembg model name (default u2net; others: u2netp, u2net_human_seg, isnet-general-use). Non-u2net models download on first use.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          output: { type: 'string', required: true },
          input: { type: 'string', required: true },
          model: { type: 'string', required: true },
          width: { type: 'number' },
          height: { type: 'number' },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: `背景已移除：${value.output}（${value.width}×${value.height}，模型 ${value.model}）`,
      }],
    },
    async execute(args, exec) {
      const model = args.model || settings.get().model
      const stem = basename(args.path, extname(args.path))
      const outPath = join(dirname(args.path), `${stem}_no_bg.png`)

      const current = settings.get()
      if (current.autoInstall) await ensureInstalled(current)

      const { stdout } = await runCommand(
        python,
        [worker, '--input', args.path, '--output', outPath, '--model', model],
        { signal: exec.signal, timeoutMs: config.timeoutMs },
      )
      return parseResult(stdout)
    },
  }))
}
