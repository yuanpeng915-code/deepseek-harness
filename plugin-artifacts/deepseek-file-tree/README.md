# DeepSeek file tree plugin (deepseek-file-tree)

English | [中文](README.zh.md)

A **non-invasive** file tree plugin for the DSH sidebar: it adds a folder icon labeled "Files" to the workspace browser header (next to the search / view-options / add-workspace icons). Clicking it opens a **file tree drawer** overlaid on the sidebar, showing the current workspace's files and folders recursively in a VS Code-style tree with collapsible folders. Every file/folder row ends with a "+" that appends that path to the current composer draft. **The original workspace browser is untouched**; the icon still shows while the rail is collapsed.

- Plugin id: `file-2`
- Current package: `file-2/pkg-7`
- Depends on the shipped `sidebar.workspaces.action` header action slot (`@deepseek-ai/dsh-client-ui-workspace`)
- Dynamic Cordis plugin (process-level; after a restart it must be re-defined from `plugin-source.js`)

## Features

| Interaction | Behavior |
| --- | --- |
| Header "Files" icon | In the workspace browser header (`sidebar.workspaces.action`), folder icon, 16px wide-rail / 18px narrow-rail; click toggles the drawer |
| Drawer | `shell.overlay` float overlaying the sidebar's left side (280px wide, full height), with a title (current workspace name), refresh, and close |
| File tree | Breadth-first recursive listing of the current workspace directory; folders expand/collapse (chevron rotation) |
| "+" | An outline plus at the end of every file/folder row (styled like the workspace item "+", highlighted on hover); clicking appends the absolute path to the composer |

## Architecture

```
┌─ Host half ──────────────────────────────────────────┐
│ harness.handle('file:tree', { root })                │
│   → ctx.get('fs').listDir breadth-first tree build   │
│   → { ok, root, tree: [{name,path,kind,children}] } │
└──────────────────────────────────────────────────────┘
        │ host.call('file:tree')
        ▼
┌─ Client half ────────────────────────────────────────┐
│ FileTreeToggle (sidebar.workspaces.action) → header icon toggles drawer │
│ FileTreeDrawer (shell.overlay) → drawer + tree render│
│   └─ TreeNode recursive render, collapse + "+"       │
│ InsertBridge (conversation.input.right, session scope)│
│   → useInput + inputActions.setDraft appends path    │
└──────────────────────────────────────────────────────┘
```

- **Non-invasive**: it does not occupy `sidebar.workspaces` (single slot, would shadow shipped UI); the original workspace browser stays intact.
- **Tree build**: breadth-first (BFS), listing each level's siblings before descending, so alphabetically-early deep directories cannot exhaust the budget and starve other top-level items.
- **Path insertion**: the sidebar/overlay (root scope) has no `inputActions`, so an invisible bridge component mounted on `conversation.input.right` (session scope, rendered stably with the composer) obtains `useInput`/`inputActions` and appends via `setDraft(oldDraft + ' ' + path)`.
- **Ignored directories**: `node_modules`, `.git`, `lib`, `dist`, `build`, `out`, `coverage`, `.DS_Store`, `.dsh-build`, `.next`, `.turbo`, `.cache`, `.pnpm-store`, `.vite`; depth cap 12, entry cap 5000.

## Data model

```ts
interface TreeNode {
  name: string       // file/folder name
  path: string       // absolute path (used for insertion into the composer)
  kind: 'dir' | 'file'
  children?: TreeNode[]  // directories only
}
// file:tree returns { ok: true, root: string, tree: TreeNode[] }
```

## Known trade-offs

- The tree is a **drawer overlay**, not a replacement for a sidebar region: while open it covers the sidebar, and on close the original workspace browser is still in place. This trades the "switch in place" experience for zero invasiveness.
- Build-output directories (`node_modules`/`lib`/`dist` etc.) are ignored; to show them, edit the Host half's `IGNORED` table and re-define.

## Source

The complete reproducible source lives in [`plugin-source.js`](./plugin-source.js) alongside this file (the Host half and Client half function bodies, ready for `cordis_define`'s `code.host` / `code.client`).
