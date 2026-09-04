# @deepseek-ai/dsh-client-ui-model-board

English | [中文](README.zh.md)

Model pricing board beside the sidebar Settings trigger. A footer action shows the current DeepSeek API peak/off-peak phase and output price; hovering opens an overlay popover with the full weekday/weekend pricing schedule.

- Registers `sidebar.footer.action` (footer cell) and `shell.overlay` (popover), sharing one hover store.
- The pricing schedule and model prices are embedded constants (DeepSeek official schedule, effective 2026-08-23, Beijing time); the phase is computed client-side from the local clock via `Intl` in `Asia/Shanghai`.

## Model Experience

None, as this package renders a read-only browser surface and does not reach the agent, the session log, or the model.

#### KV Cache effect

No model request exists to cache against; the pricing schedule never enters agent input.
