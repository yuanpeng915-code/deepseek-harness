/** One directory-tree node returned to the browser. */

export interface FileTreeNode {
  name: string
  path: string
  kind: 'dir' | 'file'
  children?: FileTreeNode[]
}
