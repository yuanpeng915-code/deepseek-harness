/** Workspace header file-tree drawer browser half. */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { FileTreeNode } from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import {
  FileTreeToggle, FileTreeDrawer, InsertBridge, createFileTreeStore,
  type FileTreeDrawerInjected, type FileTreeBridgeInjected,
} from './FileTree.tsx'

/** Services required by the three registrations. */
export const inject = ['slots', 'remote', 'remote.fileTree']

/** Mount the header toggle, the overlay drawer, and the composer insert bridge. */
export function apply(ctx: ClientContext): void {
  const store = createFileTreeStore()

  // Drawer writes a requested path; the session-scoped bridge consumes it.
  const insertBus = {
    pending: null as string | null,
    listeners: new Set<() => void>(),
    request(path: string): void { this.pending = path; this.listeners.forEach((fn) => { fn() }) },
    consume(): string | null { const path = this.pending; this.pending = null; return path },
    subscribe(fn: () => void): () => void { this.listeners.add(fn); return () => { this.listeners.delete(fn) } },
  }

  const tree = async (root: string): Promise<FileTreeNode[]> => {
    const result = await ctx.remote.fileTree.tree(root)
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }

  const drawerInjected = (): FileTreeDrawerInjected => ({
    tree,
    requestInsert: (path) => { insertBus.request(path) },
  })
  const bridgeInjected = (): FileTreeBridgeInjected => ({
    subscribeInsert: fn => insertBus.subscribe(fn),
    consumeInsert: () => insertBus.consume(),
  })

  ctx.slots.inject('sidebar.workspaces.action', () => ctx.slots.register(
    { name: 'sidebar.workspaces.action', id: 'filetree-toggle', store },
    FileTreeToggle,
  ))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register(
    { name: 'shell.overlay', id: 'filetree-drawer', store, inject: drawerInjected },
    FileTreeDrawer,
  ))
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register(
    { name: 'conversation.input.right', id: 'filetree-insert-bridge', inject: bridgeInjected },
    InsertBridge,
  ))
}
