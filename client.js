window.__ModuleLoader__.load({ id: 'dsh-rembg', factory: (require) => {
  const React = require('react')
  const ROUTE = '/_dsh/rembg-gpu/settings'
  const MIRRORS = [
    ['阿里云 PyPI', 'https://mirrors.aliyun.com/pypi/simple/'],
    ['官方 PyPI', 'https://pypi.org/simple'],
  ]
  const CSS = '.rg-card{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3);list-style:none;min-width:0}.rg-head{display:flex;align-items:center;width:100%;gap:12px;padding:14px 16px;color:inherit;background:transparent;border:0;text-align:left;font:inherit;cursor:pointer}.rg-headtext{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}.rg-title{font-weight:600;font-size:15px}.rg-desc,.rg-hint,.rg-status{display:block;font-size:12px;color:var(--dsw-alias-label-tertiary);margin-top:6px;overflow-wrap:anywhere}.rg-body{border-top:1px solid var(--dsw-alias-border-l2);padding:0 16px 12px}.rg-field{display:flex;flex-direction:column;gap:6px;margin-top:14px}.rg-status-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 24px}.rg-status-ok{color:#2e9b5f}.rg-status-error{color:#c23b3b}.rg-input{box-sizing:border-box;width:100%;height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:0 10px;background:var(--dsw-alias-bg-layer-3);color:inherit}.rg-actions{display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-top:16px;min-width:0}.rg-init-options{display:flex;align-items:center;gap:10px}.rg-check{display:flex;align-items:center;gap:7px;font-size:13px;white-space:nowrap}.rg-check input{margin:0}.rg-action-message{flex:1;min-width:0;margin-top:0}.rg-button{flex:none;padding:6px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:transparent;color:inherit;cursor:pointer;white-space:nowrap}.rg-button:disabled{opacity:.5;cursor:default}.rg-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.rg-danger{background:#c23b3b;border-color:#c23b3b;color:#fff}.rg-model-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:20px}.rg-model{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;border-top:1px solid var(--dsw-alias-border-l2);padding:10px 0;min-width:0}.rg-model-name{display:block;font-size:13px;overflow-wrap:anywhere}.rg-progress{height:6px;margin-top:8px;border-radius:3px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}.rg-progress-bar{height:100%;background:#2e9b5f;transition:width .2s ease}.rg-download-meta{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--dsw-alias-label-tertiary);margin-top:5px}.rg-small{padding:4px 8px;font-size:12px}@media(max-width:640px){.rg-status-row,.rg-model-list{grid-template-columns:1fr}.rg-actions{align-items:flex-end;flex-wrap:wrap}.rg-action-message{flex-basis:100%}.rg-body{padding-left:12px;padding-right:12px}}'

  function store() {
    let snapshot = { status: 'loading', writable: false, settings: { value: {}, base: {}, revision: 0 }, installation: { status: 'not-installed', mode: null }, gpu: { ok: false, reason: '' }, models: [] }
    const listeners = new Set()
    const notify = () => listeners.forEach(listener => listener())
    const patch = (value) => { snapshot = value; notify() }
    const load = async () => {
      const body = await (await fetch(ROUTE)).json()
      if (!body.ok) throw new Error(body.error?.message || '读取失败')
      patch(body.value)
    }
    const post = async (data) => {
      const body = await (await fetch(ROUTE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })).json()
      if (!body.ok) throw new Error(body.error?.message || '请求失败')
      patch(body.value)
    }
    const optimistic = (transform, request) => {
      patch(transform(snapshot))
      return request().catch(async error => {
        try { await load() } catch {}
        throw error
      })
    }
    return {
      get: () => snapshot,
      sub: listener => (listeners.add(listener), () => listeners.delete(listener)),
      load,
      mutate: ops => post({ action: 'mutate', ops, expectedRevision: snapshot.settings.revision }),
      init: () => optimistic(
        current => ({ ...current, installation: { ...current.installation, status: 'installing', error: null } }),
        () => post({ action: 'initialize' }),
      ),
      install: id => optimistic(
        current => ({ ...current, models: current.models.map(model => model.id === id ? { ...model, status: 'installing' } : model) }),
        () => post({ action: 'install-model', model: id }),
      ),
      stop: id => post({ action: 'stop-model', model: id }),
       remove: id => optimistic(
        current => ({ ...current, models: current.models.map(model => model.id === id ? { ...model, status: 'not-installed' } : model) }),
        () => post({ action: 'delete-model', model: id }),
      ),
    }
  }

  function formatSize(bytes) {
    if (!Number.isFinite(bytes)) return '大小未知'
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
    return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`
  }
  function formatSpeed(bytes) {
    return `${formatSize(bytes)}/s`
  }

  function Card({ controller }) {
    const state = React.useSyncExternalStore(controller.sub, controller.get, controller.get)
    const [open, setOpen] = React.useState(false)
    const [message, setMessage] = React.useState('')
    const [confirmInitialization, setConfirmInitialization] = React.useState(false)
    React.useEffect(() => {
      controller.load().catch(error => setMessage(error.message))
      const timer = setInterval(() => controller.load().catch(() => {}), 500)
      return () => clearInterval(timer)
    }, [])
    React.useEffect(() => {
      if (state.installation.status !== 'installed') setConfirmInitialization(false)
    }, [state.installation.status])
    const value = state.settings.value || {}
    const mirror = MIRRORS.find(item => item[1] === value.pipIndexUrl) || MIRRORS[0]
    const useGpu = value.useGpu === true
    const initializing = state.installation.status === 'installing'
    const modeLabel = state.installation.mode === 'gpu' ? 'GPU' : state.installation.mode === 'cpu' ? 'CPU' : '未初始化'
    const action = async (request, pending) => {
      setMessage(pending)
      try { await request(); setMessage('操作完成') } catch (error) { setMessage(error.message) }
    }
    return React.createElement('li', { className: 'rg-card' },
      React.createElement('button', { className: 'rg-head', onClick: () => setOpen(!open), 'aria-expanded': open },
        React.createElement('span', { className: 'rg-headtext' },
          React.createElement('span', { className: 'rg-title' }, 'rembg 图像背景移除'),
          React.createElement('span', { className: 'rg-desc' }, '可选择 CPU 或 GPU 模式初始化，模型需单独管理。')),
        open ? '⌃' : '⌄'),
      open && React.createElement('div', { className: 'rg-body' },
        React.createElement('div', { className: 'rg-field' },
          React.createElement('label', { className: 'rg-title' }, 'pip 镜像源'),
          React.createElement('select', { className: 'rg-input', value: mirror[1], disabled: !state.writable || initializing, onChange: event => action(() => controller.mutate([{ op: 'set', path: ['pipIndexUrl'], value: event.target.value }]), '正在保存镜像源…') },
            MIRRORS.map(item => React.createElement('option', { key: item[1], value: item[1] }, item[0])))),
        React.createElement('div', { className: 'rg-field rg-status-row' },
          React.createElement('div', null,
            React.createElement('span', { className: 'rg-title' }, 'GPU 环境'),
            React.createElement('span', { className: `rg-status ${state.gpu.ok ? 'rg-status-ok' : 'rg-status-error'}` }, state.gpu.ok ? '满足要求' : `不满足要求：${state.gpu.reason || '正在检测…'}`)),
          React.createElement('div', null,
            React.createElement('span', { className: 'rg-title' }, 'Python 环境状态'),
            React.createElement('span', { className: `rg-status ${state.installation.status === 'installed' ? 'rg-status-ok' : 'rg-status-error'}` }, `${({ installed: '已安装', 'not-installed': '未安装', installing: '正在安装' }[state.installation.status] || '未安装')} · ${modeLabel}`),
            state.installation.status === 'installing' && state.installation.installLog && React.createElement('span', { className: 'rg-hint' }, state.installation.installLog))),
        React.createElement('div', { className: 'rg-actions' },
          React.createElement('span', { className: 'rg-hint rg-action-message' }, message),
          React.createElement('div', { className: 'rg-init-options' },
            React.createElement('label', { className: 'rg-check' },
              React.createElement('input', { type: 'checkbox', checked: useGpu, disabled: !state.gpu.ok || initializing || !state.writable, onChange: event => action(() => controller.mutate([{ op: 'set', path: ['useGpu'], value: event.target.checked }]), '正在保存运行模式…') }),
              '使用 GPU'),
            React.createElement('button', {
              className: `rg-button${confirmInitialization ? ' rg-danger' : ''}`,
              disabled: (useGpu && !state.gpu.ok) || initializing || !state.writable,
              onClick: () => {
                if (state.installation.status === 'installed' && !confirmInitialization) {
                  setConfirmInitialization(true)
                  return
                }
                setConfirmInitialization(false)
                action(controller.init, `正在安装 Python ${useGpu ? 'GPU' : 'CPU'} 环境…`)
              },
            }, initializing ? '正在安装' : confirmInitialization ? '确认初始化' : '初始化环境'))),
        React.createElement('div', { className: 'rg-field' },
          React.createElement('span', { className: 'rg-title' }, '模型列表'),
          React.createElement('div', { className: 'rg-model-list' }, state.models.map(model => {
            const downloading = model.status === 'installing'
            const installed = model.status === 'installed'
            const label = installed ? '已安装' : downloading ? '下载中' : model.status === 'invalid' ? '校验无效' : '未安装'
            return React.createElement('div', { className: 'rg-model', key: model.id },
              React.createElement('span', null,
                React.createElement('span', { className: 'rg-model-name' }, model.id),
                React.createElement('span', { className: 'rg-hint' }, `${model.label} · ${formatSize(model.size)} · ${label}`),
                downloading && React.createElement(React.Fragment, null,
                  React.createElement('div', { className: 'rg-progress' }, React.createElement('div', { className: 'rg-progress-bar', style: { width: `${model.progress?.total ? Math.min(100, model.progress.downloaded / model.progress.total * 100) : 0}%` } })),
                  React.createElement('div', { className: 'rg-download-meta' },
                    React.createElement('span', null, `${formatSize(model.progress?.downloaded || 0)} / ${formatSize(model.progress?.total || model.size)}`),
                    React.createElement('span', null, formatSpeed(model.progress?.speed || 0))))),
              installed
                ? React.createElement('button', { className: 'rg-button rg-small rg-danger', disabled: !state.writable, onClick: () => action(() => controller.remove(model.id), '正在删除模型…') }, '删除')
                : downloading
                  ? React.createElement('button', { className: 'rg-button rg-small rg-danger', disabled: !state.writable, onClick: () => action(() => controller.stop(model.id), '正在停止下载…') }, '停止')
                  : React.createElement('button', { className: 'rg-button rg-small', disabled: !state.writable, onClick: () => action(() => controller.install(model.id), '正在下载模型…') }, '安装'))
          })))))
  }

  function apply(ctx) {
    const style = document.createElement('style')
    style.textContent = CSS
    document.head.appendChild(style)
    ctx.effect(() => () => style.remove(), 'rembg-gpu: styles')
    const controller = store()
    ctx.slots.inject('settings.plugin.item', () => ctx.slots.register({ name: 'settings.plugin.item', key: 'rembg-gpu-tool', id: 'rembg-gpu-tool', order: 55, inject: () => ({ controller }) }, Card))
  }
  return { inject: ['slots'], apply }
} })
