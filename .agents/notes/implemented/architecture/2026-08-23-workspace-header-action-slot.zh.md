# Agent Note: 工作区浏览器暴露头部动作插槽

Status: implemented

[English](2026-08-23-workspace-header-action-slot.md) | 中文

## Problem

侧边栏工作区浏览器的头部有三个硬编码控件——搜索、视图选项、添加工作区——功能插件没有任何方式添加自己的头部动作（例如文件树开关）。想要头部图标的插件只能替换整个 `sidebar.workspaces` 区域，从而丢掉发货的会话浏览器。

## Decision

`ui-workspace` 声明 `sidebar.workspaces.action`——一个根作用域的 `list` 插槽，渲染在头部 `headerActions` 行、添加工作区按钮之后。条目接收 `{ wide }` owner props，以便渲染宽栏 16px 图标或窄栏 18px 图标。该插槽是附加型（`replaceRisk: none`），功能插件贡献图标而无需替换浏览器；文件树插件在此注册其开关。

## Alternatives considered

**在浏览器里硬编码文件树图标。** 否决：把发货浏览器耦合到某个具体功能；插槽让任何功能都能添加头部动作。

**复用现有插槽。** 否决：`sidebar.workspaces` 下唯一的子插槽是目录流洞（directory-flow），它是一个单一的选择面，不是头部动作行。

## Consequences

- `sidebar.workspaces.action` 是新的公共扩展点；条目获得 `{ wide }` 并自行渲染图标几何。
- 发货的工作区浏览器保持完整；文件树插件的开关挂在该插槽上，在宽栏与窄栏两种状态下都显示。
