# @deepseek-ai/dsh-host-file-tree

[English](README.md) | 中文

仅远程调用的 Host 服务，把一个工作区目录列举为嵌套的、广度优先的目录树，供 Web 文件树浏览器使用。消费 `fs` 服务；忽略构建 / 版本控制 / 缓存目录，并限制深度（12）与条目数（5000）。

## 模型体验

None, as this package exposes a read-only directory listing to the browser and never reaches the agent loop.

#### KV Cache 影响

没有可缓存的模型请求；目录列表不会进入 agent 输入。

## 已知限制与暂缓事项

- **Bounded snapshot only** — the tree caps depth (12) and entries (5000) and reflects the moment of the call; there is no change feed, so the browser re-fetches to observe edits.
