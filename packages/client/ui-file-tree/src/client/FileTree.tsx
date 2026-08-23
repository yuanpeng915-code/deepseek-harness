/** Workspace header file-tree drawer, insert bridge, and shared store. */

import { useEffect, useRef, useState } from 'react'
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import type { FileTreeNode } from '@deepseek-ai/dsh-api-remotes/client'
import type { InjectFace, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import css from './FileTree.module.css'

type FileTreeState = { open: boolean }
type FileTreeActions = { setOpen: (d: FileTreeState, open: boolean) => void }

/** Shared drawer-open state between the header toggle and the overlay drawer. */
export function createFileTreeStore(): EngineStoreHandle<FileTreeState, FileTreeActions> {
  return defineStore({
    init: (): FileTreeState => ({ open: false }),
    actions: { setOpen: (d, open) => { d.open = open } },
  })
}

type FileTreeStore = ReturnType<typeof createFileTreeStore>

/** Drawer face: the Remote tree call and the path-insert request. */
export interface FileTreeDrawerInjected {
  tree: (root: string) => Promise<FileTreeNode[]>
  requestInsert: (path: string) => void
}

/** Bridge face: subscription into the shared insert bus. */
export interface FileTreeBridgeInjected {
  subscribeInsert: (fn: () => void) => () => void
  consumeInsert: () => string | null
}

type ToggleProps = PropsRuntime<'sidebar.workspaces.action'> & PropsStore<FileTreeStore>
type DrawerProps = PropsRuntime<'shell.overlay'> & PropsStore<FileTreeStore> & InjectFace<FileTreeDrawerInjected>
type BridgeProps = PropsRuntime<'conversation.input.right'> & InjectFace<FileTreeBridgeInjected>

const FolderIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
    <path d="M2 4a1 1 0 0 1 1-1h3l2 2h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" stroke="currentColor" strokeWidth={1.2} fill="none" strokeLinejoin="round" />
  </svg>
)

const FileIcon = () => (
  <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4 2h5l3 3v9H4zM9 2v3h3" stroke="currentColor" strokeWidth={1.2} fill="none" strokeLinejoin="round" />
  </svg>
)

const PlusIcon = () => (
  <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" fill="none" />
  </svg>
)

/** Header icon (in `sidebar.workspaces.action`) that toggles the drawer. */
export function FileTreeToggle({ wide, useStore, actions }: ToggleProps) {
  const open = useStore(s => s.open)
  const classes = `${css.hbtn}${open ? ` ${css.hbtnActive}` : ''}${wide ? '' : ` ${css.hbtnRail}`}`
  return (
    <button
      type="button"
      className={classes}
      title="文件"
      aria-label="文件"
      aria-expanded={open}
      onClick={() => { actions.setOpen(!open) }}
    >
      <FolderIcon size={wide ? 16 : 18} />
    </button>
  )
}

/** Overlay drawer rendering the current workspace's collapsible tree. */
export function FileTreeDrawer({ useStore, actions, useWorkspaces, useSessions, tree, requestInsert }: DrawerProps) {
  const open = useStore(s => s.open)
  const ws = useWorkspaces(s => s)
  const ss = useSessions(s => s)
  const [nodes, setNodes] = useState<FileTreeNode[] | null>(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const [reload, setReload] = useState(0)

  const items = ws.items
  const currentWs = items.find(w => ss.current !== undefined && w.sessionIds.includes(ss.current)) ?? items[0]
  const rootPath = currentWs?.path ?? ''

  useEffect(() => {
    if (!open || rootPath === '') { setNodes(null); return }
    let alive = true
    setError('')
    setNodes(null)
    setTitle(currentWs?.title ?? '文件')
    tree(rootPath).then(
      (value) => { if (alive) setNodes(value) },
      (reason: unknown) => { if (alive) setError(reason instanceof Error ? reason.message : String(reason)) },
    )
    return () => { alive = false }
  }, [open, rootPath, reload, tree])

  if (!open) return null

  const toggleDir = (path: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path); else next.add(path)
      return next
    })
  }

  return (
    <div className={css.drawer}>
      <div className={css.head}>
        <span className={css.title}>{title}</span>
        <button type="button" className={css.headBtn} title="刷新" onClick={() => { setReload(r => r + 1) }}>↻</button>
        <button type="button" className={css.headBtn} title="关闭" onClick={() => { actions.setOpen(false) }}>✕</button>
      </div>
      <div className={css.body}>
        {error !== '' ? <div className={css.error}>{error}</div> : null}
        {nodes === null && error === '' ? <div className={css.empty}>读取中…</div> : null}
        {nodes !== null && nodes.length === 0 ? <div className={css.empty}>目录为空</div> : null}
        {nodes !== null ? (
          <div>
            {nodes.map(n => (
              <TreeNode key={n.path} node={n} depth={0} expanded={expanded} onToggle={toggleDir} onInsert={requestInsert} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

interface TreeNodeProps {
  node: FileTreeNode
  depth: number
  expanded: ReadonlySet<string>
  onToggle: (path: string) => void
  onInsert: (path: string) => void
}

function TreeNode({ node, depth, expanded, onToggle, onInsert }: TreeNodeProps) {
  const isDir = node.kind === 'dir'
  const open = expanded.has(node.path)
  const chevron = isDir
    ? <span className={open ? `${css.chevron} ${css.chevronOpen}` : css.chevron} onClick={() => { onToggle(node.path) }}>▸</span>
    : <span className={css.chevron} style={{ visibility: 'hidden' }}>▸</span>
  return (
    <div className={css.node}>
      <div className={css.row} style={{ paddingLeft: 6 + depth * 12 }}>
        {chevron}
        <span className={css.icon}>{isDir ? <FolderIcon size={14} /> : <FileIcon />}</span>
        <span className={css.name} title={node.path} onClick={isDir ? () => { onToggle(node.path) } : undefined}>{node.name}</span>
        <button type="button" className={css.add} title="添加到对话框" onClick={() => { onInsert(node.path) }}><PlusIcon /></button>
      </div>
      {isDir && open && node.children !== undefined && node.children.length > 0 ? (
        <div>
          {node.children.map(c => (
            <TreeNode key={c.path} node={c} depth={depth + 1} expanded={expanded} onToggle={onToggle} onInsert={onInsert} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Session-scoped bridge: appends the requested path into the composer draft. */
export function InsertBridge({ useInput, inputActions, subscribeInsert, consumeInsert }: BridgeProps) {
  const draft = useInput(s => s.draft)
  const draftRef = useRef(draft)
  draftRef.current = draft

  useEffect(() => subscribeInsert(() => {
    const path = consumeInsert()
    if (path === null) return
    const current = draftRef.current
    inputActions.setDraft(current ? `${current} ${path}` : path)
  }), [inputActions, subscribeInsert, consumeInsert])

  return null
}
