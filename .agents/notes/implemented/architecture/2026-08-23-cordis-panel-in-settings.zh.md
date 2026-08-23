# Agent Note: Cordis 面板迁移到设置中，不再占据侧边栏底部

Status: implemented

[English](2026-08-23-cordis-panel-in-settings.md) | 中文

## Problem

动态 Cordis 插件界面（清单、审批、版本、运行/停止/移除）此前以侧边栏底部动作的形式呈现：一个「Cordis Plugin N running」徽标，点击后打开一个 420px、固定定位、锚定在徽标上的浮层。底部还承载其它附加动作，因此发货的底栏叠成两行——动作在设置上方——开发向的 Cordis 控件占据了主要位置。用户希望把这些控件收进设置，把底栏简化为「设置 + 一个对齐在其右侧的紧凑附加动作」。

## Decision

`ui-cordis` 将 Cordis 清单注册为 `settings.plugins.tab` 条目（id `dynamic`、order `20`、label「Dynamic plugins」/「动态插件」），取代原先的 `sidebar.footer.action` 条目。`CordisPanel` 组件现在以内联方式渲染为 tab 页面：徽标、固定定位浮层、外部点击关闭、审批自动展开均已移除；清单列表、版本选择器、审批/运行/停止/移除操作以及逐行错误保持不变。`ui-cordis` 把对 `@deepseek-ai/dsh-client-ui-sidebar` 的依赖替换为 `@deepseek-ai/dsh-client-ui-settings`（即 `settings.plugins.tab` 插槽类型所在包）。

`ui-sidebar` 的底栏改为水平排列：`sidebar.settings` 在左（`flex: 1`）、`sidebar.footer.action` 在右（`flex: none`），使紧凑的附加动作与设置在同一基线上、位于其右侧。折叠成窄栏时保留原有的居中垂直堆叠。

## Alternatives considered

**保留底部浮层，仅在设置里加一个链接。** 否决：同一清单出现两个入口会带来不一致，且徽标的运行/审批计数会失去唯一展示位。

**把面板注册为顶层 `settings.section`。** 否决：现有的 Plugins 分区已经聚合了插件相关界面，在其中加一个 tab 可复用其导航，而无需再占据一个设置导航行。

**保留徽标，同时内联渲染清单。** 否决：会把清单逻辑与状态在两个组件间重复。

## Consequences

- 「Cordis Plugin N running」徽标及其审批自动展开已移除；审批现在位于 设置 → Plugins → Dynamic plugins。
- 发货组合中 `sidebar.footer.action` 为空，成为紧凑附加动作（例如模型看板芯片）对齐在设置右侧的保留席位。
- `ui-cordis` 移除对 `@deepseek-ai/dsh-client-ui-sidebar` 的依赖、新增对 `@deepseek-ai/dsh-client-ui-settings` 的依赖；客户端插槽目录重新生成，CordisPanel 占用者改列于 `settings.plugins.tab` 之下。

## Related

- [Cordis Host/Client Dynamic Plugin Runtime](../../proposed/architecture/2026-08-08-cordis-web-dynamic-packages.zh.md) — `ui-cordis` 所属的运行时；本记录确定其全局面板的位置。
