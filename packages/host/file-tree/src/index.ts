/** Remote-only service that lists a workspace directory tree. */

import type { Context } from '@deepseek-ai/cordis'
import type { FileSystem, FsTarget } from '@deepseek-ai/dsh-fs'
import type {} from '@deepseek-ai/dsh-fs'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type { FileTreeNode } from './types.ts'

export type * from './types.ts'

/** Directories never listed (build outputs, VCS, and cache trees). */
const IGNORED = new Set([
  'node_modules', '.git', '.dsh-build', '.next', '.turbo', '.cache',
  'coverage', 'dist', 'build', 'out', 'lib', '.DS_Store', '.pnpm-store', '.vite',
])

/** Nesting cap and entry budget so a hostile/deep tree cannot stall the page. */
const MAX_DEPTH = 12
const MAX_ENTRIES = 5000

/** Remote-only service exposing a breadth-first workspace directory tree. */
export class FileTreeGateway extends TypertRemoteService {
  static inject = ['fs']

  constructor(ctx: Context) {
    super(ctx, 'fileTree')
  }

  /**
   * List one workspace root as a nested tree, breadth-first so top-level
   * siblings are never starved by a deep alphabetical-first directory.
   * @param root - absolute workspace path.
   * @returns the root's children.
   */
  @Remote('tree')
  async tree(root: string): Promise<FileTreeNode[]> {
    return buildTree(this.ctx.fs, root)
  }
}

export default FileTreeGateway

interface PendingDir {
  readonly target: FsTarget
  readonly node: FileTreeNode
  readonly depth: number
}

/** Breadth-first build: every level's siblings are listed before descending. */
async function buildTree(fs: FileSystem, root: string): Promise<FileTreeNode[]> {
  const rootTarget = await fs.resolve(root)
  const budget = { count: 0, max: MAX_ENTRIES }
  const rootNode: FileTreeNode = { name: '', path: fs.processPath(rootTarget), kind: 'dir', children: [] }
  const queue: PendingDir[] = [{ target: rootTarget, node: rootNode, depth: 0 }]
  while (queue.length > 0 && budget.count < budget.max) {
    const cur = queue.shift()
    if (cur === undefined) break
    if (cur.depth >= MAX_DEPTH) continue
    let entries
    try {
      entries = await fs.listDir(cur.target)
    } catch {
      continue
    }
    for (const entry of entries) {
      if (budget.count >= budget.max) break
      if (IGNORED.has(entry.name)) continue
      budget.count++
      const child: FileTreeNode = {
        name: entry.name,
        path: fs.processPath(entry.target),
        kind: entry.type === 'directory' ? 'dir' : 'file',
      }
      if (entry.type === 'directory') {
        child.children = []
        queue.push({ target: entry.target, node: child, depth: cur.depth + 1 })
      }
      ;(cur.node.children ??= []).push(child)
    }
  }
  return rootNode.children ?? []
}
