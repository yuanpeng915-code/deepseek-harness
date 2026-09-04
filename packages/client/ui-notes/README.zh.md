# @deepseek-ai/dsh-client-ui-notes

[English](README.md) | 中文

便签界面插件，浏览器半部：会话体工具条（`conversation.session.body.utilities`）中的一个条目 —— noty 风格的触发按钮及其悬挂其下的下拉面板，右对齐位于头部分隔线与消息区之间，构建在 `notes` 投影之上。便签本身通过 `useProjection('notes')` 到达 —— 宿主计算的整个 `NotesState` —— 因此插件不拥有持久状态；其会话级 store 只保存交互状态（面板开关、编辑草稿、最近错误）。槽位 inject face 携带四个便签动词（`put` / `delete` / `setInject` / `import`，经 `ctx.remote.notes`）；被拒绝的 Remote 动词原文透传到 store 的错误行，成功保存则关闭编辑器。面板按置顶优先、最近编辑优先排序；每张卡片提供置顶、内联编辑与删除，头部持有注入开关、一次性导入按钮（无便签时禁用）与关闭控件。

`/client` 导出插件体（`apply`/`inject`）、`createNotesStore` 工厂与注入动词 face 类型。

## Model Experience

间接地，通过面板调用的 `put`、`delete`、`setInject`、`import` Remote 方法：前两者提交逐条 `note/put` / `note/delete` 会话事件，第三者提交 `note/inject`，导入组合一条用户消息 steer。插件自身不添加任何提示内容。

#### KV Cache effect

无直接影响。记录的注入开关开启时，任何便签变更都会重写宿主渲染的 `notes:context` 节并使自该节起的前缀缓存复用失效 —— 该契约由 [notes 包 README](../../notes/notes/README.zh.md) 拥有。

## Known Limitations and Deferred Work

- **无乐观写入** —— 面板仅在 Remote 动词提交后渲染投影；往返慢时编辑器保持打开，挂起条目没有本地回显。
- **仅面板本地交互状态** —— 开启/编辑器/错误状态存于会话级 store，重载后重置；无持久化，也无跨标签页同步。
