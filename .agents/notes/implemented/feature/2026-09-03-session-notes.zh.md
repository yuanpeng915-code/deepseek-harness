# Agent Note: 会话便签

Status: implemented

[English](2026-09-03-session-notes.md) | 中文

## Problem

一个对话需要用户拥有的草稿区：用户想随手保留的小段文本，并按需放到模型面前——而不必把每个草稿都升级成一条消息。harness 中没有任何东西承载每会话的用户便签：todo 列表归模型所有，goal 是模型生命周期状态，composer 草稿是易逝的。参考体验是 [noty](https://github.com/aimen08/noty) 钉在屏幕边缘的彩色纸质便签。

## Decision

会话便签以一个 host 插件加一个浏览器插件交付，仅挂载在 `web-app` bundle：

- `@deepseek-ai/dsh-notes`（`ctx.notes`，[packages/notes/notes](../../../../packages/notes/notes)）拥有状态。每次变更都是一条独立的 log-only `SessionEventMap` 事件——`note/put`（携带颜色与置顶的 upsert）、`note/delete`、`note/inject`——因此持久状态完全存于所属会话日志并可从中重放。服务按需把事件折叠为 `notes` 投影单元，并将四个 Remote 动词（`put`、`delete`、`setInject`、`import`）暴露为每会话 Typert 服务。失败是携带稳定 `notes-*` 代码的显式 `NoteError`；没有任何静默跳过。
- 模型只通过两条用户发起的路径遇见便签：`notes:context` 系统提示节（order 60），在记录的注入开关开启时渲染折叠后的便签；以及一次性 `import` 动词，把选中的便签组合为一条 steer 的用户消息。开关同时驱动执行循环：每个 settled 回合结束后，服务把创建最早的便签作为一条用户消息 steer 进入对话并删除，直到队列清空、开关自动记录为关闭。颜色、id 与时间戳从不渲染进模型可见文本。
- `@deepseek-ai/dsh-client-ui-notes`（[packages/client/ui-notes](../../../../packages/client/ui-notes)）提供 noty 风格面板：ui-conversation 新增 `conversation.session.body.utilities` 工具条（钉在头部分隔线与滚动区之间）上的一个条目，触发器与下拉面板成对出现，含增/改/删、六色 noty 调色板、置顶、执行便签任务开关（无便签时禁用）与导入按钮。面板直接读投影并调用四个动词，并按创建时间正序排列 —— 即执行循环遵循的从上到下队列顺序。

## Alternatives considered

- **为什么不用面向模型的工具？** `notes_*` 工具族能让 agent 自己读写草稿区，但便签是用户拥有的草稿；工具面需要工具目录条目、boot manifest 接线与快照覆盖，且当前没有消费者需要模型发起的访问。已推迟；该限制记录在包 README。
- **为什么不用整体快照事件（todo 模式）？** 每次变更一条 `notes/snapshot` 事件更简单，但每次提交编辑都会重写整个列表，并使并发面板编辑对整个列表 last-writer-wins。逐条事件按条目合并。
- **为什么不把便签物化为上下文消息（`ctx.systemPrompt.context`）？** 它会以用户角色消息的形式复制导入路径并每步重发，与刻意的一次性导入相互竞争，且膨胀每个请求。
- **为什么不用浏览器 localStorage？** 便签必须跨设备跟随对话并在浏览器重启后存活；会话日志是 harness 中唯一被视为每会话持久状态的存储。

## Consequences

注入路径以缓存稳定性换取始终新鲜的上下文：开关开启时，每次便签编辑都会重写 `notes:context` 节文本并使自该节起的前缀复用失效。`put` 是无条件替换——同一条便签的两个并发编辑者以最后写入者胜出；没有 compare-and-set。网页面板是唯一写入者，因此 host 插件只挂载在 web-app bundle，headless 组装不受影响；未来的 CLI 或模型侧写入者需要自己的挂载决策。

## Related

逐条事件、按需折叠投影与每会话 Typert 服务模式沿用 goal 子系统（[docs/subsystems/goal.md](../../../../docs/subsystems/goal.zh.md)）；数据模型与服务参考是 [docs/subsystems/notes.md](../../../../docs/subsystems/notes.zh.md)。
