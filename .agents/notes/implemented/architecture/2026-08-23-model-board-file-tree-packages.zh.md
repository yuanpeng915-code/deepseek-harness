# Agent Note: 价格看板与文件树以 Web 组合包形式交付

Status: implemented

[English](2026-08-23-model-board-file-tree-packages.md) | 中文

## Problem

价格看板与工作区文件树此前是会话本地的动态 Cordis 插件：由代理在运行时定义并授权，每次服务重启即丢失，也不会出现在 设置 → 插件 → 插件列表 中。它们的 UI 依赖动态专用 API（`harness.handle`、`host.call`、`styles.insert`），文件树只能通过每次运行私有的处理器访问 Host 文件系统。

## Decision

两个界面都作为注册进 web bundle 的普通组合包交付：

- `@deepseek-ai/dsh-client-ui-model-board` — 纯客户端。定价时段与模型价格内嵌为常量；阶段计算在纯 `pricing.ts` 模块中。在一个 `createBoardStore()` 悬停 store 上注册 `sidebar.footer.action`（底部单元格）与 `shell.overlay`（浮层）。
- `@deepseek-ai/dsh-host-file-tree` — 一个 `TypertRemoteService`（`remote.fileTree`），其 `@Remote('tree')` 方法通过 `fs` 以广度优先嵌套树列出工作区目录，跳过构建/VCS/缓存目录并限制深度（12）与条目（5000）。
- `@deepseek-ai/dsh-client-ui-file-tree` — 注册工作区头部开关（`sidebar.workspaces.action`）、覆盖抽屉（`shell.overlay`）与会话作用域插入桥接（`conversation.input.right`），后者把选中的路径追加到对话框草稿。抽屉通过由 `api-remotes` 挂载的 `remote.fileTree.tree` 读取树。

## Alternatives considered

**保持动态。** 否决：重启即丢失、也从不进入插件列表，而这正是要解决的诉求。

**把文件树内联进 `ui-workspace`。** 否决：会把发货的工作区浏览器耦合到某个功能；头部动作插槽让浏览器保持功能无关。

**通过自定义 HTTP 路由暴露目录列表。** 否决：已有的 `TypertRemoteService` 路径已承载授权、生成的客户端接口与拆卸。

## Consequences

- 两个界面随服务启动自动加载并出现在 设置 → 插件 → 插件列表；旧的动态插件可退役。
- 文件树的文件系统访问是只读、有界的 Host Remote，而非无界的每次运行处理器。
- `api-remotes` 增加 `fileTree` 命名空间；新客户端包在标准 `remote` 服务之外注入 `remote.fileTree`。
