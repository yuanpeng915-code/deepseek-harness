# Agent Note: 插件配置卡片使用共享的 SettingsCard 原语

Status: implemented

[English](2026-08-23-plugin-config-card-spec.md) | 中文

## Problem

设置 → 插件 各 tab（可配置插件、插件清单、动态插件）各自在三个不同的 CSS 模块里重复定义了同一套卡片外观——760px 的列宽以及单张插件卡片的边框/圆角/表面 token。这种重复产生了漂移（12px 与 10px 的圆角不一致），并诱使每个新的插件配置界面再发明一种变体。

## Decision

卡片外观集中在 `ui-primitives` 的一对共享原语中：`SettingsCard`（边框 `--dsw-alias-border-l2`、圆角 10px、背景 `--dsw-alias-bg-layer-3`、`open` 高亮为 `border-l1` + `bg-layer-2`，并带 `data-open` 标记）与 `SettingsCardSection`（760px 列）。原语只负责外观；内容布局（内边距、间距、头部/主体）通过卡片的 `className` 留在功能包的 CSS 模块中。`ui-cordis` 的 `CordisPanel`（动态插件 tab）已消费这两个原语。该规范记录在 [`docs/web-styling.md`](../../../docs/web-styling.md) 的「Plugin configuration cards」一节。

## Alternatives considered

**只记录 token，不提供共享代码。** 否决：仅靠文字无法阻止漂移；共享原语让「遵循规范」成为默认。

**抽取一个完整的卡片组件（头部、主体、详情）。** 否决：三个 tab 承载的内容各不相同；只有外观是共通的，强加单一结构会造成别扭的适配。

**在 `ui-theme` 放一份全局样式表。** 否决：外观是组件表面，不像滚动条或重置那样是横切关注点，因此应放在共享组件包中。

## Consequences

- 新的插件配置界面组合使用 `SettingsCard`/`SettingsCardSection`；重新定义外观即成为需要说明理由的偏离。
- `ui-cordis` 移除了本地的 `.row`/`.inline` 外观，只保留内容布局。`ui-settings-plugin-inventory` 与 `ui-settings-plugins` 仍各自定义了符合该规范的本地卡片外观，是后续迁移对象。
- `SettingsCard` 暴露 `data-open`，使测试与 CSS 选择器无需读取哈希类名即可观察打开状态。

## Related

- [Cordis 面板迁移到设置中，不再占据侧边栏底部](./2026-08-23-cordis-panel-in-settings.zh.md) —— 将动态插件界面移入设置 tab 的改动，本记录整合了其卡片外观。
