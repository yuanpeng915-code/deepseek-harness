# @deepseek-ai/dsh-notes

[English](README.md) | 中文

会话级便签：由用户拥有的每会话草稿区，持久状态完全存于所属会话日志。服务按需从逐条 `note/put` / `note/delete` / `note/inject` 事件折叠状态，并为网页面板提供变更动词；便签只通过两条导入路径触达模型。字面数据结构见 [notes 子系统页](../../../docs/subsystems/notes.zh.md)。

## Config

```yaml
- id: notes
  name: '@deepseek-ai/dsh-notes'
  config:
    maxNoteBytes: 4096
    maxNotes: 100
```

`maxNoteBytes`（每条便签正文的 UTF-8 字节数）与 `maxNotes`（每会话保留的便签条数）都必须是正的安全整数；违规在插件加载时失败。

## Service contract

`ctx.notes` 只接受以其 id 注册的确切存活 `Agent` 实例。`put` 创建一条便签（服务分配 id，默认颜色 `yellow`，未置顶）或按 id 替换，请求缺省时保留已记录的颜色与置顶状态，并将 `updatedAt` 对抗时钟回拨做钳制。`delete` 对未知 id 显式拒绝而非空操作。`setInject` 记录任务执行开关，拒绝在空队列上启用，且在循环空闲时启用会立即执行第一条便签；记录状态已一致时跳过事件。`importAsMessage` 将选中的便签 —— 请求缺省 `ids` 时为全部，创建早者在前 —— 组合为一条用户消息 steer，模型在下一轮看到；未知 id 或空选择会被拒绝。所有失败都是携带稳定 `notes-*` 代码的 `NoteError`；没有任何静默跳过。可调用 API 是 [notes.md](../../../docs/subsystems/notes.zh.md#cordis-surface) 的生成区域。

服务贡献 `notes` 投影单元（整个 `NotesState` 值）与 `notes:context` 系统提示节（order 60），后者仅在记录的开关开启时渲染折叠便签；关闭时节为空。两个子项仅在对应注册表被组合时激活，headless 组装不受影响。

单独发布的 `./invariant` companion 在候选事件进入持久日志前拒绝畸形的 `note/put` 负载（空白文本、未知颜色、非单调时间戳）、指向不存在 id 的 `note/delete`，以及畸形的 `note/inject` 负载。

## Extension points

消费者插件调用服务动词并读取 `notes` 投影；网页界面（`@deepseek-ai/dsh-client-ui-notes`）拥有面板 UI 与两条导入路径的用户触发器。没有工具或命令面。

## Model Experience

### 任务执行与 `notes:context` 节

#### What the model sees

开关开启时由服务自己跑队列：每个 settled 回合结束后，创建最早的一条便签作为一条用户消息被 steer 进入对话并被删除；队列清空后开关自动记录为关闭。循环空闲时启用会立即执行第一条便签；空队列启用被拒绝；开启状态下删除最后一条便签会把开关记录为关闭。每次模型请求另外携带一个系统提示节，其文本渲染剩余便签：一行标题，随后每条便签一个 bullet，创建早者在前，置顶便签以 `[pinned] ` 前缀标记。颜色、id 与时间戳不出现在渲染文本中。开关关闭 —— 或没有便签 —— 时不贡献文本。

##### Verbatim text for this field, when needed

```markdown
The user's sticky notes for this conversation (oldest first):

- <[pinned] >note text
```

#### Token effect

条件性固定加线性：空节不贡献 token；开关开启时节加入渲染的便签行，并随便签数量与文本长度增长至上限（`maxNotes` 条 × 每条 `maxNoteBytes` 字节）。

#### KV Cache effect

该节位于系统提示的有序节列表中，因此切换开关或编辑任何便签都会替换先前渲染的节文本，并使自该节起的前缀缓存复用失效。开关关闭时节保持为空并保留周围前缀。

### 作为用户消息导入（`import` Remote）

#### What the model sees

一条用户消息，其文本以前导行开头，随后是同样的置顶优先、`[pinned] ` 前缀 bullet 列表。该消息与任何其他用户轮次一样进入对话。

##### Verbatim text for this field, when needed

```markdown
Here are my sticky notes to bring into this conversation:

- <[pinned] >note text
```

#### Token effect

一次性线性增长：组合的消息按所选便签文本增加 token，并此后留在 transcript 中。

#### KV Cache effect

Append-only：消息扩展历史尾部；后续便签编辑不会改写它。

## Known Limitations and Deferred Work

- **无模型工具** —— agent 自身无法读写便签；两条导入路径都由用户发起。模型侧工具面需要工具目录条目、boot manifest 与快照覆盖。
- **无 compare-and-set** —— `put` 无条件替换，同一便签的两个并发编辑者最后写入者获胜；跨客户端冲突检测被推迟。
- **注入时的前缀缓存失效** —— 开关开启时，每次便签变更都会重写 `notes:context` 节文本并使自该节起的前缀缓存复用失效。
