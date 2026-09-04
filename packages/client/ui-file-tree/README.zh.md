# @deepseek-ai/dsh-client-ui-file-tree

[English](README.md) | 中文

工作区头部的文件树抽屉。工作区浏览器头部（`sidebar.workspaces.action`）的文件夹图标切换一个覆盖抽屉，展示当前工作区的目录树；文件夹可折叠/展开，每个文件/文件夹行有一个 `+`，把其绝对路径追加到 composer 草稿（经挂在 `conversation.input.right` 的会话作用域桥接组件）。树数据来自 `remote.fileTree` Remote（`@deepseek-ai/dsh-host-file-tree`）。

## 模型体验

None, as this package renders a read-only directory tree and writes paths into the composer draft; it never reaches the agent or the session log.

#### KV Cache 影响

composer 草稿是用户可见的 UI 文本；只有用户发送时才随普通输入一样进入模型请求。

## 已知限制与暂缓事项

- **仅整树重取** —— 抽屉在每次打开与刷新时重新请求完整列表；没有增量变更推送。
