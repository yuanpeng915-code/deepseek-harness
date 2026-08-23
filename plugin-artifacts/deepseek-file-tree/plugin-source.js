/**
 * deepseek-file-tree (file-2 / pkg-7)
 * DSH 侧边栏非侵入式文件树插件（工作区头部「文件」图标开关抽屉）。
 *
 * 使用方式（DSH 重启后恢复）：
 *   cordis_define 时，把下方 hostBody / clientBody 分别填入 code.host / code.client，
 *   然后 cordis_run（首次需在 Web GUI 批准）。
 *
 * 依赖发货的 sidebar.workspaces.action 头部动作插槽（ui-workspace 包）。
 *
 * 文档见 README.md。
 */

// ============================================================
// Host half（填入 cordis_define 的 code.host）
// ============================================================
const hostBody = `return {
  apply(ctx) {
    const IGNORED = { node_modules: 1, '.git': 1, '.dsh-build': 1, '.next': 1, '.turbo': 1, '.cache': 1, coverage: 1, dist: 1, build: 1, out: 1, lib: 1, '.DS_Store': 1, '.pnpm-store': 1, '.vite': 1 }
    const MAX_DEPTH = 12
    const MAX_ENTRIES = 5000
    const fs = ctx.get('fs')

    // 广度优先建树：先列出每一层所有兄弟，再逐层深入，避免字母序靠前的深层目录耗尽预算、饿死兄弟节点
    async function buildTree(rootTarget) {
      if (fs === undefined) return []
      const budget = { count: 0, max: MAX_ENTRIES }
      const rootNode = { name: '', path: fs.processPath(rootTarget), kind: 'dir', children: [] }
      const queue = [{ target: rootTarget, node: rootNode, depth: 0 }]
      let head = 0
      while (head < queue.length) {
        const cur = queue[head++]
        if (cur.depth >= MAX_DEPTH || budget.count >= budget.max) continue
        let entries
        try { entries = await fs.listDir(cur.target) } catch { continue }
        for (const entry of entries) {
          if (budget.count >= budget.max) break
          if (IGNORED[entry.name] === 1) continue
          budget.count++
          const child = { name: entry.name, path: fs.processPath(entry.target), kind: entry.type === 'directory' ? 'dir' : 'file' }
          cur.node.children.push(child)
          if (entry.type === 'directory') {
            child.children = []
            queue.push({ target: entry.target, node: child, depth: cur.depth + 1 })
          }
        }
      }
      return rootNode.children
    }

    ctx.effect(() => harness.handle('file:tree', async (args) => {
      if (fs === undefined) return { ok: false, error: '文件系统服务不可用' }
      const root = args && typeof args.root === 'string' ? args.root : ''
      if (root === '') return { ok: false, error: '缺少工作区路径' }
      try {
        const rootTarget = await fs.resolve(root)
        const tree = await buildTree(rootTarget)
        return { ok: true, root: fs.processPath(rootTarget), tree }
      } catch (err) {
        return { ok: false, error: String((err && err.message) || err) }
      }
    }))

    console.log('文件树插件已启动')
  },
}`

// ============================================================
// Client half（填入 cordis_define 的 code.client）
// ============================================================
const clientBody = `return {
  apply(ctx) {
    const CSS = \`
.dsh-ft-hbtn{flex:none;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:none;border-radius:50%;padding:0;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;}
.dsh-ft-hbtn:hover,.dsh-ft-hbtn[data-active='true']{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}
.dsh-ft-drawer{position:fixed;left:0;top:0;bottom:0;width:280px;z-index:1000;display:flex;flex-direction:column;background:var(--dsw-specific-sidebar-fill);border-right:1px solid var(--dsw-alias-border-l2);box-shadow:2px 0 12px rgba(0,0,0,.15);}
.dsh-ft-drawer-head{flex:none;display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid var(--dsw-alias-border-l2);}
.dsh-ft-drawer-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);}
.dsh-ft-drawer-close,.dsh-ft-drawer-refresh{flex:none;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;}
.dsh-ft-drawer-close:hover,.dsh-ft-drawer-refresh:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dsh-ft-body{flex:1;min-height:0;overflow-y:auto;padding:2px 6px 10px;}
.dsh-ft-node{font-size:12px;color:var(--dsw-alias-label-secondary);}
.dsh-ft-row{display:flex;align-items:center;gap:4px;height:24px;padding:0 6px;border-radius:6px;white-space:nowrap;}
.dsh-ft-row:hover{background:var(--dsw-alias-interactive-bg-hover);}
.dsh-ft-chevron{flex:none;width:14px;height:14px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:var(--dsw-alias-label-tertiary);transition:transform 120ms;user-select:none;}
.dsh-ft-chevron.open{transform:rotate(90deg);}
.dsh-ft-icon{flex:none;display:inline-flex;color:var(--dsw-alias-label-tertiary);}
.dsh-ft-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;cursor:default;}
.dsh-ft-add{flex:none;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;opacity:.55;}
.dsh-ft-row:hover .dsh-ft-add{opacity:1;}
.dsh-ft-add:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);}
.dsh-ft-empty{padding:10px 8px;font-size:12px;color:var(--dsw-alias-label-tertiary);}
.dsh-ft-error{padding:10px 8px;font-size:12px;color:var(--dsw-alias-state-error-primary);}
\`

    const slots = ctx.get('slots')
    if (slots === undefined) return
    ctx.effect(() => styles.insert(CSS))

    const drawerStore = {
      open: false,
      listeners: new Set(),
      setOpen(v) { this.open = v; this.listeners.forEach((fn) => fn()) },
      subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) },
    }

    const insertStore = {
      pending: null,
      listeners: new Set(),
      request(path) { this.pending = path; this.listeners.forEach((fn) => fn()) },
      subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) },
    }

    const PlusIcon = () => React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 16 16', 'aria-hidden': true },
      React.createElement('path', { d: 'M8 3v10M3 8h10', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', fill: 'none' }))
    const FolderIcon = (size) => React.createElement('svg', { width: size || 14, height: size || 14, viewBox: '0 0 16 16', 'aria-hidden': true },
      React.createElement('path', { d: 'M2 4a1 1 0 0 1 1-1h3l2 2h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z', stroke: 'currentColor', strokeWidth: 1.2, fill: 'none', strokeLinejoin: 'round' }))
    const FileIcon = () => React.createElement('svg', { width: 14, height: 14, viewBox: '0 0 16 16', 'aria-hidden': true },
      React.createElement('path', { d: 'M4 2h5l3 3v9H4zM9 2v3h3', stroke: 'currentColor', strokeWidth: 1.2, fill: 'none', strokeLinejoin: 'round' }))

    function useDrawer() {
      const [, setTick] = React.useState(0)
      React.useEffect(() => drawerStore.subscribe(() => setTick((t) => t + 1)), [])
      return drawerStore
    }

    function InsertBridge(props) {
      const useInput = props.useInput
      const inputActions = props.inputActions
      const draft = typeof useInput === 'function' ? useInput((s) => (s && s.draft) || '') : ''
      const draftRef = React.useRef(draft)
      draftRef.current = draft
      React.useEffect(() => {
        const unsub = insertStore.subscribe(() => {
          const path = insertStore.pending
          if (path === null) return
          insertStore.pending = null
          const d = draftRef.current
          const next = d ? d + ' ' + path : path
          if (inputActions && typeof inputActions.setDraft === 'function') inputActions.setDraft(next)
        })
        return unsub
      }, [])
      return null
    }

    function TreeNode({ node, depth, expanded, onToggle, onInsert }) {
      const isDir = node.kind === 'dir'
      const open = expanded.has(node.path)
      const el = React.createElement
      const chevron = isDir
        ? el('span', { className: 'dsh-ft-chevron' + (open ? ' open' : ''), onClick: () => onToggle(node.path) }, '▸')
        : el('span', { className: 'dsh-ft-chevron', style: { visibility: 'hidden' } }, '▸')
      return el('div', { className: 'dsh-ft-node' },
        el('div', { className: 'dsh-ft-row', style: { paddingLeft: (6 + depth * 12) + 'px' } },
          chevron,
          el('span', { className: 'dsh-ft-icon' }, isDir ? FolderIcon(14) : FileIcon()),
          el('span', { className: 'dsh-ft-name', title: node.path, onClick: isDir ? () => onToggle(node.path) : undefined }, node.name),
          el('button', { className: 'dsh-ft-add', title: '添加到对话框', onClick: () => onInsert(node.path) }, PlusIcon()),
        ),
        isDir && open && node.children && node.children.length > 0
          ? el('div', null, node.children.map((c) => el(TreeNode, { key: c.path, node: c, depth: depth + 1, expanded: expanded, onToggle: onToggle, onInsert: onInsert })))
          : null,
      )
    }

    function FileTreeToggle({ wide }) {
      const drawer = useDrawer()
      const el = React.createElement
      return el('button', { className: 'dsh-ft-hbtn', 'data-active': drawer.open ? 'true' : 'false', title: '文件', 'aria-label': '文件', onClick: () => drawerStore.setOpen(!drawerStore.open) },
        FolderIcon(wide ? 16 : 18),
      )
    }

    function FileTreeDrawer({ useWorkspaces, useSessions }) {
      const drawer = useDrawer()
      const ws = useWorkspaces((s) => s)
      const ss = useSessions((s) => s)
      const [tree, setTree] = React.useState(null)
      const [error, setError] = React.useState('')
      const [expanded, setExpanded] = React.useState(() => new Set())
      const [reload, setReload] = React.useState(0)
      const el = React.createElement

      const items = ws && ws.items ? ws.items : []
      const currentWs = items.find((w) => ss && ss.current && w.sessionIds && w.sessionIds.includes(ss.current)) || items[0]
      const rootPath = currentWs ? currentWs.path : ''

      React.useEffect(() => {
        if (!drawer.open || rootPath === '') { setTree(null); return }
        let alive = true
        setError('')
        setTree(null)
        host.call('file:tree', { root: rootPath }).then((res) => {
          if (!alive) return
          if (res && res.ok) setTree(res.tree); else setError((res && res.error) || '读取失败')
        }).catch((err) => { if (alive) setError(String((err && err.message) || err)) })
        return () => { alive = false }
      }, [drawer.open, rootPath, reload])

      const toggleDir = (path) => {
        setExpanded((prev) => {
          const next = new Set(prev)
          if (next.has(path)) next.delete(path); else next.add(path)
          return next
        })
      }
      const insert = (path) => { insertStore.request(path) }

      if (!drawer.open) return null

      return el('div', { className: 'dsh-ft-drawer' },
        el('div', { className: 'dsh-ft-drawer-head' },
          el('span', { className: 'dsh-ft-drawer-title' }, currentWs ? currentWs.title : '文件'),
          el('button', { className: 'dsh-ft-drawer-refresh', title: '刷新', onClick: () => setReload((r) => r + 1) }, '↻'),
          el('button', { className: 'dsh-ft-drawer-close', title: '关闭', onClick: () => drawerStore.setOpen(false) }, '✕'),
        ),
        el('div', { className: 'dsh-ft-body' },
          error !== '' ? el('div', { className: 'dsh-ft-error' }, error) : null,
          tree === null && error === '' ? el('div', { className: 'dsh-ft-empty' }, '读取中…') : null,
          tree && tree.length === 0 ? el('div', { className: 'dsh-ft-empty' }, '目录为空') : null,
          tree ? el('div', null, tree.map((n) => el(TreeNode, { key: n.path, node: n, depth: 0, expanded: expanded, onToggle: toggleDir, onInsert: insert }))) : null,
        ),
      )
    }

    slots.inject('sidebar.workspaces.action', () => slots.register(
      { name: 'sidebar.workspaces.action', id: 'filetree-toggle' },
      FileTreeToggle,
    ))
    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'filetree-drawer' },
      FileTreeDrawer,
    ))
    slots.inject('conversation.input.right', () => slots.register(
      { name: 'conversation.input.right', id: 'filetree-insert-bridge' },
      InsertBridge,
    ))

    console.log('文件树插件客户端已启动')
  },
}`

module.exports = { hostBody, clientBody }
