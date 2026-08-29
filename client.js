window.__ModuleLoader__.load({ id: 'dsh-rembg', factory: (require) => {
  const React = require('react')
  const ROUTE = '/_dsh/rembg-gpu/settings'
  const MIRRORS = [
    ['阿里云 PyPI', 'https://mirrors.aliyun.com/pypi/simple/'],
    ['官方 PyPI', 'https://pypi.org/simple'],
  ]
  const CSS = `
.rg-card {
  list-style: none; min-width: 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-3);
  transition: border-color .16s, background .16s;
}
.rg-card:hover { border-color: var(--dsw-alias-label-dimmed); }
.rg-card-open { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-label-dimmed); }
.rg-head {
  display: flex; align-items: center; width: 100%; gap: 12px; padding: 14px 16px;
  color: inherit; background: transparent; border: 0; text-align: left; font: inherit;
  cursor: pointer; border-radius: 12px;
}
.rg-head:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.rg-headtext { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
.rg-title { font-weight: 600; font-size: 15px; line-height: 1.4; color: var(--dsw-alias-label-primary); }
.rg-desc { font-size: 13px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.rg-chevron { flex: none; color: var(--dsw-alias-label-tertiary); transition: transform .16s; }
.rg-chevron-open { transform: rotate(180deg); }
.rg-body { border-top: 1px solid var(--dsw-alias-border-l2); margin: 0 16px; padding: 0 0 12px; }
.rg-field { display: flex; flex-direction: column; gap: 6px; margin-top: 14px; }
.rg-hint { display: block; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); margin-top: 6px; overflow-wrap: anywhere; }
.rg-status-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 24px; }
.rg-status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; line-height: 1.5; }
.rg-status::before { content: ''; width: 8px; height: 8px; border-radius: 50%; flex: none; }
.rg-status-ok { color: var(--dsw-alias-state-success-primary); }
.rg-status-ok::before { background: var(--dsw-alias-state-success-primary); }
.rg-status-error { color: var(--dsw-alias-state-error-primary); }
.rg-status-error::before { background: var(--dsw-alias-state-error-primary); }
.rg-input {
  box-sizing: border-box; width: 100%; height: 34px;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; padding: 0 10px;
  background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 13px; transition: border-color .16s;
}
.rg-input:hover:not(:disabled) { border-color: var(--dsw-alias-label-dimmed); }
.rg-input:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 0; }
.rg-input:disabled { opacity: .5; }
.rg-actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; margin-top: 16px; min-width: 0; }
.rg-init-options { display: flex; align-items: center; gap: 12px; }
.rg-action-message { flex: 1; min-width: 0; margin-top: 0; }
.rg-button {
  flex: none; appearance: none;
  padding: 6px 14px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;
  background: transparent; color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 13px; line-height: 1.5; cursor: pointer; white-space: nowrap;
  transition: border-color .16s, color .16s, background .16s;
}
.rg-button:hover:not(:disabled) { border-color: var(--dsw-alias-label-dimmed); color: var(--dsw-alias-label-primary); }
.rg-button:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.rg-button:disabled { opacity: .4; cursor: default; }
.rg-primary { background: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-label-primary); color: var(--dsw-alias-bg-layer-3); }
.rg-danger { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.rg-danger:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-danger); border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.rg-small { padding: 3px 10px; font-size: 12px; }
.rg-stop {
  flex: none; width: 26px; height: 26px; padding: 0; border-radius: 50%;
  border: 1px solid var(--dsw-alias-border-l2); background: transparent;
  color: var(--dsw-alias-label-secondary); cursor: pointer; font-size: 13px; line-height: 1;
  display: inline-flex; align-items: center; justify-content: center;
  transition: border-color .16s, color .16s;
}
.rg-stop:hover { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); }
.rg-stop:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.rg-model-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 20px; }
.rg-model { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; border-top: 1px solid var(--dsw-alias-border-l2); padding: 10px 0; min-width: 0; }
.rg-model-name { display: block; font-size: 13px; color: var(--dsw-alias-label-primary); overflow-wrap: anywhere; }
.rg-error-text { display: block; margin-top: 4px; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-state-error-primary); overflow-wrap: anywhere; }
.rg-progress { height: 6px; margin-top: 8px; border-radius: 3px; background: var(--dsw-alias-bg-layer-1); overflow: hidden; }
.rg-progress-bar { height: 100%; background: var(--dsw-alias-state-success-primary); transition: width .2s ease; }
.rg-download-meta { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--dsw-alias-label-tertiary); margin-top: 5px; }
.rg-switch { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; user-select: none; white-space: nowrap; }
.rg-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
.rg-switch-track { position: relative; display: inline-block; box-sizing: border-box; width: 38px; height: 22px; flex: none; border-radius: 999px; background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l2); transition: background .16s, border-color .16s; }
.rg-switch-thumb { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--dsw-alias-label-tertiary); transition: transform .16s, background .16s; }
.rg-switch input:checked + .rg-switch-track { background: var(--dsw-alias-brand-primary); border-color: var(--dsw-alias-brand-primary); }
.rg-switch input:checked + .rg-switch-track .rg-switch-thumb { transform: translateX(18px); background: #fff; }
.rg-switch input:focus-visible + .rg-switch-track { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
.rg-switch input:disabled + .rg-switch-track { opacity: .4; }
@media (max-width: 640px) {
  .rg-status-row, .rg-model-list { grid-template-columns: 1fr; }
  .rg-actions { align-items: flex-end; flex-wrap: wrap; }
  .rg-action-message { flex-basis: 100%; }
  .rg-body { margin-left: 12px; margin-right: 12px; }
}
`

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
      stopInit: () => post({ action: 'stop-initialize' }),
      install: id => optimistic(
        current => ({ ...current, models: current.models.map(model => model.id === id ? { ...model, status: 'installing' } : model) }),
        () => post({ action: 'install-model', model: id }),
      ),
      stop: id => post({ action: 'stop-model', model: id }),
       remove: id => optimistic(
        current => ({ ...current, models: current.models.map(model => model.id === id ? { ...model, status: 'not-installed' } : model) }),
        () => post({ action: 'delete-model', model: id }),
      ),
      clear: () => post({ action: 'clear-environment' }),
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
    const [confirmClear, setConfirmClear] = React.useState(false)
    React.useEffect(() => {
      let cancelled = false
      let timer = null
      const tick = async () => {
        if (cancelled) return
        try {
          await controller.load()
        } catch (error) {
          if (!cancelled) setMessage(error.message)
        }
        if (cancelled) return
        const snapshot = controller.get()
        const busy = snapshot.installation.status === 'installing' || snapshot.models.some(model => model.status === 'installing')
        timer = setTimeout(tick, busy ? 500 : 5000)
      }
      tick()
      return () => { cancelled = true; if (timer) clearTimeout(timer) }
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
    const chevron = React.createElement('svg', { className: `rg-chevron${open ? ' rg-chevron-open' : ''}`, width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true },
      React.createElement('path', { d: 'M4 6l4 4 4-4', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }))
    return React.createElement('li', { className: `rg-card${open ? ' rg-card-open' : ''}` },
      React.createElement('button', { className: 'rg-head', onClick: () => setOpen(!open), 'aria-expanded': open },
        React.createElement('span', { className: 'rg-headtext' },
          React.createElement('span', { className: 'rg-title' }, 'rembg 图像背景移除'),
          React.createElement('span', { className: 'rg-desc' }, '可选择 CPU 或 GPU 模式初始化，模型需单独管理。')),
        chevron),
      open && React.createElement('div', { className: 'rg-body' },
        React.createElement('div', { className: 'rg-field' },
          React.createElement('label', { className: 'rg-title' }, 'pip 镜像源'),
          React.createElement('select', { className: 'rg-input', value: mirror[1], disabled: !state.writable || initializing, onChange: event => action(() => controller.mutate([{ op: 'set', path: ['pipIndexUrl'], value: event.target.value }]), '正在保存镜像源…') },
            MIRRORS.map(item => React.createElement('option', { key: item[1], value: item[1] }, item[0])))),
        React.createElement('div', { className: 'rg-field' },
          React.createElement('label', { className: 'rg-title' }, '默认模型'),
          React.createElement('select', { className: 'rg-input', value: value.model || 'u2net', disabled: !state.writable || initializing, onChange: event => action(() => controller.mutate([{ op: 'set', path: ['model'], value: event.target.value }]), '正在保存默认模型…') },
            state.models.map(model => React.createElement('option', { key: model.id, value: model.id }, `${model.id}${model.status === 'installed' ? '' : '（未安装）'}`)))),
        React.createElement('div', { className: 'rg-field rg-status-row' },
          React.createElement('div', null,
            React.createElement('span', { className: 'rg-title' }, 'GPU 环境'),
            React.createElement('span', { className: `rg-status ${state.gpu.ok ? 'rg-status-ok' : 'rg-status-error'}` }, state.gpu.ok ? '满足要求' : `不满足要求：${state.gpu.reason || '正在检测…'}`)),
          React.createElement('div', null,
            React.createElement('span', { className: 'rg-title' }, 'Python 环境状态'),
            React.createElement('span', { className: `rg-status ${state.installation.status === 'installed' ? 'rg-status-ok' : 'rg-status-error'}` }, `${({ installed: '已安装', 'not-installed': '未安装', installing: '正在安装' }[state.installation.status] || '未安装')} · ${modeLabel}`),
            state.installation.status === 'installing' && state.installation.installLog && React.createElement('span', { className: 'rg-hint' }, state.installation.installLog),
            state.installation.error && React.createElement('span', { className: 'rg-error-text' }, state.installation.error))),
        React.createElement('div', { className: 'rg-actions' },
          React.createElement('span', { className: 'rg-hint rg-action-message' }, message),
          React.createElement('div', { className: 'rg-init-options' },
            React.createElement('label', { className: 'rg-switch' },
              React.createElement('input', { type: 'checkbox', checked: useGpu, disabled: !state.gpu.ok || initializing || !state.writable, onChange: event => action(() => controller.mutate([{ op: 'set', path: ['useGpu'], value: event.target.checked }]), '正在保存运行模式…') }),
              React.createElement('span', { className: 'rg-switch-track' }, React.createElement('span', { className: 'rg-switch-thumb' })),
              '使用 GPU'),
            React.createElement('button', {
              className: `rg-button${confirmInitialization ? ' rg-danger' : ' rg-primary'}`,
              disabled: (useGpu && !state.gpu.ok) || initializing || !state.writable,
              onClick: () => {
                if (state.installation.status === 'installed' && !confirmInitialization) {
                  setConfirmInitialization(true)
                  return
                }
                setConfirmInitialization(false)
                setMessage(`正在安装 Python ${useGpu ? 'GPU' : 'CPU'} 环境…`)
                controller.init().catch(error => setMessage(error.message))
              },
            }, initializing ? '正在安装' : confirmInitialization ? '确认初始化' : '初始化环境'),
          initializing && React.createElement('button', {
            className: 'rg-stop',
            title: '停止安装',
            'aria-label': '停止安装',
            onClick: () => action(() => controller.stopInit(), '正在停止安装…'),
          }, '✕'))),
        React.createElement('div', { className: 'rg-field' },
          React.createElement('span', { className: 'rg-title' }, '模型列表'),
          React.createElement('div', { className: 'rg-model-list' }, state.models.map(model => {
            const downloading = model.status === 'installing'
            const installed = model.status === 'installed'
            const progress = model.progress || {}
            const total = progress.total || model.size || 0
            const downloaded = progress.downloaded || 0
            const percent = total > 0 ? Math.min(100, downloaded / total * 100) : 0
            const label = installed ? '已安装' : downloading ? '下载中' : model.status === 'invalid' ? '校验无效' : '未安装'
            return React.createElement('div', { className: 'rg-model', key: model.id },
              React.createElement('span', null,
                React.createElement('span', { className: 'rg-model-name' }, model.id),
                React.createElement('span', { className: 'rg-hint' }, `${model.label} · ${formatSize(model.size)} · ${label}`),
                model.error && React.createElement('span', { className: 'rg-error-text' }, model.error),
                downloading && React.createElement(React.Fragment, null,
                  React.createElement('div', { className: 'rg-progress' }, React.createElement('div', { className: 'rg-progress-bar', style: { width: `${percent}%` } })),
                  React.createElement('div', { className: 'rg-download-meta' },
                    React.createElement('span', null, `${percent.toFixed(0)}% · ${formatSize(downloaded)} / ${formatSize(total)}`),
                    React.createElement('span', null, formatSpeed(progress.speed || 0))))),
              installed
                ? React.createElement('button', { className: 'rg-button rg-small rg-danger', disabled: !state.writable, onClick: () => action(() => controller.remove(model.id), '正在删除模型…') }, '删除')
                : downloading
                  ? React.createElement('button', { className: 'rg-button rg-small rg-danger', disabled: !state.writable, onClick: () => action(() => controller.stop(model.id), '正在停止下载…') }, '停止')
                  : React.createElement('button', { className: 'rg-button rg-small', disabled: !state.writable, onClick: () => action(() => controller.install(model.id), '正在下载模型…') }, '安装'))
          }))),
        React.createElement('div', { className: 'rg-actions' },
          React.createElement('span', { className: 'rg-hint rg-action-message' }, '清空环境会删除虚拟环境与所有已下载模型，需重新初始化。'),
          React.createElement('button', {
            className: `rg-button${confirmClear ? ' rg-danger' : ''}`,
            disabled: initializing || !state.writable,
            onClick: () => {
              if (!confirmClear) { setConfirmClear(true); return }
              setConfirmClear(false)
              action(controller.clear, '正在清空环境…')
            },
          }, confirmClear ? '确认清空' : '清空环境'))))
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
