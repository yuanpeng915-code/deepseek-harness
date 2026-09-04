# notes/ — 会话便签

[English](README.md) | 中文

用户拥有的每会话便签，持久状态完全存于所属会话日志。便签只通过两条导入路径（上下文注入与一次性用户消息）触达模型；没有模型侧工具。

| Package | Role | ctx key |
|---|---|---|
| [`notes/`](notes/README.zh.md) | 便签状态、服务、投影与 `notes:context` 节 | `ctx.notes` |

子系统参考 —— 数据模型、服务行为与事件溯源 —— 见 [docs/subsystems/notes.zh.md](../../docs/subsystems/notes.zh.md)。
