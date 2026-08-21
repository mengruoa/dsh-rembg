// Browser half for the rembg settings card.
// This intentionally uses the same settings.plugin.item contract as the
// reference dsh-bg-tool plugin, while keeping the card self-contained.
window.__ModuleLoader__.load({ id: "dsh-rembg", factory: (require) => {
  const React = require('react')
  const ROUTE = '/_dsh/rembg/settings'
  const MIRRORS = [
    ['清华 PyPI + ghfast', 'https://pypi.tuna.tsinghua.edu.cn/simple', 'https://ghfast.top/'],
    ['阿里云 PyPI + ghproxy', 'https://mirrors.aliyun.com/pypi/simple/', 'https://ghproxy.net/'],
    ['中科大 PyPI + ghproxy', 'https://pypi.mirrors.ustc.edu.cn/simple/', 'https://gh-proxy.com/'],
    ['官方源（直连）', '', ''],
  ]
  const CSS = `.rembg-card{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:12px;list-style:none}.rembg-head{display:flex;align-items:center;width:100%;gap:12px;padding:14px 16px;color:inherit;background:transparent;border:0;text-align:left;font:inherit;cursor:pointer}.rembg-headtext{display:flex;flex-direction:column;gap:4px;flex:1}.rembg-title{font-size:15px;font-weight:600}.rembg-desc,.rembg-hint{font-size:12px;color:var(--dsw-alias-label-tertiary)}.rembg-body{border-top:1px solid var(--dsw-alias-border-l2);padding:0 16px 12px}.rembg-field{display:flex;flex-direction:column;gap:6px;padding:12px 0}.rembg-label{font-size:13px;font-weight:500}.rembg-input{height:34px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:0 10px;background:var(--dsw-alias-bg-layer-3);color:inherit}.rembg-actions{display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--dsw-alias-border-l2);padding-top:12px}.rembg-button{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:6px 12px;background:transparent;color:inherit;cursor:pointer}.rembg-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.rembg-status{font-size:12px;color:var(--dsw-alias-label-secondary)}`
  function scope() {
    let snap = { status: 'loading', writable: false, value: {}, base: {}, user: {}, revision: 0 }
    const listeners = new Set()
    const notify = () => listeners.forEach((fn) => fn())
    const load = async () => { const r = await fetch(ROUTE); const b = await r.json(); if (!b.ok) throw new Error(b.error?.message || '读取失败'); snap = { status: 'ready', writable: b.value.writable, ...b.value.settings }; notify() }
    const mutate = async (ops) => { const r = await fetch(ROUTE, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ action:'mutate', ops, expectedRevision:snap.revision }) }); const b=await r.json(); if(!b.ok) throw new Error(b.error?.message || '保存失败'); snap={status:'ready',writable:b.value.writable,...b.value.settings}; notify() }
    const initialize = async () => { const r=await fetch(ROUTE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'initialize'})}); const b=await r.json(); if(!b.ok) throw new Error(b.error?.message || '初始化失败'); notify() }
    return { getSnapshot:()=>snap, subscribe:(fn)=>(listeners.add(fn),()=>listeners.delete(fn)), load, mutate, initialize }
  }
  function Card({ controller }) {
    const s = React.useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
    const [open,setOpen]=React.useState(false); const [draft,setDraft]=React.useState({}); const [status,setStatus]=React.useState('')
    React.useEffect(()=>{ controller.load().catch(e=>setStatus(e.message)) },[])
    const value={...s.base,...s.value,...draft}; const choose=(v)=>{const m=MIRRORS.find(x=>x[0]===v)||MIRRORS[0];setDraft({pipIndexUrl:m[1],ghMirror:m[2]})}
    const save=async()=>{try{await controller.mutate(Object.entries(draft).map(([path,value])=>({op:'set',path:[path],value})));setDraft({});setStatus('已保存')}catch(e){setStatus(e.message)}}
    const init=async()=>{setStatus('正在初始化环境…');try{await controller.initialize();setStatus('环境初始化完成')}catch(e){setStatus(e.message)}}
    return React.createElement('li', { className: 'rembg-card' },
      React.createElement('button', { className: 'rembg-head', onClick: () => setOpen(!open), 'aria-expanded': open },
        React.createElement('span', { className: 'rembg-headtext' },
          React.createElement('span', { className: 'rembg-title' }, 'rembg 图像背景移除'),
          React.createElement('span', { className: 'rembg-desc' }, '选择镜像源并在设置页初始化本地 Python 环境.')),
        open ? '⌃' : '⌄'),
      open && React.createElement('div', { className: 'rembg-body' },
        React.createElement('div', { className: 'rembg-field' },
          React.createElement('label', { className: 'rembg-label' }, '镜像源'),
          React.createElement('select', { className: 'rembg-input', value: MIRRORS.find(x => x[1] === value.pipIndexUrl && x[2] === value.ghMirror)?.[0] || MIRRORS[0][0], disabled: !s.writable, onChange: e => choose(e.target.value) },
            MIRRORS.map(x => React.createElement('option', { key: x[0], value: x[0] }, x[0]))),
          React.createElement('span', { className: 'rembg-hint' }, value.pipIndexUrl || 'pip 官方源；GitHub 直连')),
        React.createElement('div', { className: 'rembg-field' },
          React.createElement('label', { className: 'rembg-label' }, '安装目录'),
          React.createElement('input', { className: 'rembg-input', value: value.installDir || '', readOnly: true })),
        React.createElement('div', { className: 'rembg-actions' },
          React.createElement('span', { className: 'rembg-status' }, status),
          React.createElement('button', { className: 'rembg-button', onClick: init, disabled: !s.writable }, '初始化环境'),
          React.createElement('button', { className: 'rembg-button rembg-primary', onClick: save, disabled: !s.writable || !Object.keys(draft).length }, '保存'))))
  }
  function apply(ctx) { const style=document.createElement('style');style.textContent=CSS;document.head.appendChild(style);ctx.effect(()=>()=>style.remove(),'dsh-rembg: styles');const controller=scope();ctx.slots.inject('settings.plugin.item',()=>ctx.slots.register({name:'settings.plugin.item',key:'rembg-tool',id:'rembg-tool',order:50,inject:()=>({controller})},Card)) }
  return { inject:['slots'], apply }
} })
