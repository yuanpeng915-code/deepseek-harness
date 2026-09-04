# @deepseek-ai/dsh-client-ui-model-board

[English](README.md) | 中文

侧边栏设置按钮旁的模型定价看板。脚部动作按钮显示 DeepSeek API 当前的高峰/低谷时段与输出价格；悬停打开浮层气泡，展示完整的工作日/周末定价时段表。

- 注册 `sidebar.footer.action`（脚部单元格）与 `shell.overlay`（浮层气泡），共享一个悬停 store。
- 定价时段表与模型价格是内嵌常量（DeepSeek 官方时段表，2026-08-23 生效，北京时间）；时段由客户端基于本地时钟通过 `Intl` 按 `Asia/Shanghai` 计算。

## 模型体验

None, as this package renders a read-only browser surface and does not reach the agent, the session log, or the model.

#### KV Cache 影响

没有可缓存的模型请求；定价时段表不会进入 agent 输入。
