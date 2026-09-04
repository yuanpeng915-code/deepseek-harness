# DeepSeek 文件树插件（deepseek-file-tree）

[English](README.md) | 中文

DSH 侧边栏的**非侵入式**文件树插件：在工作区浏览器头部（搜索 / 视图选项 / 添加工作区图标旁）新增一个「文件」文件夹图标，点击打开一个覆盖在侧边栏上的**文件树抽屉**，按 VS Code 目录树风格递归展示当前工作区的文件与文件夹（可折叠）。每个文件/文件夹行尾有一个「+」号，点击后把该路径追加到当前对话框草稿。**原工作区浏览器完全不受影响**，窄栏（rail）收起时图标照常显示。

- 插件 ID：`file-2`
- 当前包：`file-2/pkg-7`
- 依赖发货的 `sidebar.workspaces.action` 头部动作插槽（`@deepseek-ai/dsh-client-ui-workspace`）
- 动态 Cordis 插件（进程级，重启后需按 `plugin-source.js` 重新定义）

## 功能

| 交互 | 行为 |
| --- | --- |
| 头部「文件」图标 | 工作区浏览器头部（`sidebar.workspaces.action`），文件夹图标，宽栏 16px / 窄栏 18px；点击开关抽屉 |
| 抽屉 | `shell.overlay` 浮层，覆盖在侧边栏左侧（280px 宽、全高），含标题（当前工作区名）、刷新、关闭 |
| 文件树 | 广度优先递归展示当前工作区目录；文件夹可展开/折叠（chevron 旋转） |
| 「+」号 | 每个文件/文件夹行尾的 outline plus（样式与工作区项目「+」一致，悬停高亮）；点击把绝对路径追加到对话框 |

## 架构

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

- **非侵入**：不占用 `sidebar.workspaces`（单槽、会遮蔽发货 UI），原工作区浏览器保持完整。
- **建树**：广度优先（BFS），每层先列完所有兄弟再深入，避免字母序靠前的深层目录耗尽预算、饿死其它顶层项。
- **路径插入**：侧边栏/浮层（root 作用域）没有 `inputActions`，因此用挂在 `conversation.input.right`（会话作用域，随 composer 稳定渲染）的隐形桥接组件拿到 `useInput`/`inputActions`，`setDraft(旧草稿 + ' ' + 路径)` 实现追加。
- **目录忽略**：跳过 `node_modules`、`.git`、`lib`、`dist`、`build`、`out`、`coverage`、`.DS_Store`、`.dsh-build`、`.next`、`.turbo`、`.cache`、`.pnpm-store`、`.vite`；深度上限 12、条目上限 5000。

## 数据模型

```ts
interface TreeNode {
  name: string       // file/folder name
  path: string       // absolute path (used for insertion into the composer)
  kind: 'dir' | 'file'
  children?: TreeNode[]  // directories only
}
// file:tree returns { ok: true, root: string, tree: TreeNode[] }
```

## 已知权衡

- 文件树是**抽屉覆盖**而非替换侧边栏区域：打开时覆盖在侧边栏上方，关闭后原工作区浏览器仍在原位。这牺牲了「同一区域直接切换」的体验，但换来了零侵入、原功能完整。
- 忽略构建产物目录（`node_modules`/`lib`/`dist` 等）；如需展示，编辑 Host 半的 `IGNORED` 表并重新定义。

## 源码

完整可复现源码见同目录 [`plugin-source.js`](./plugin-source.js)（Host 半 + Client 半两个函数体，可直接用于 `cordis_define` 的 `code.host` / `code.client`）。
