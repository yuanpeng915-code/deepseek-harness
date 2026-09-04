# 会话便签

[English](notes.md) | 中文

由人类用户拥有的每会话便签：网页面板编辑的草稿区，模型只通过两条导入路径读取 —— 一次性 `import` steer 与可选的 `notes:context` 提示节。持久状态完全存于所属会话日志的逐条 `note/put` / `note/delete` / `note/inject` 事件中；事件参考见[持久化目录](../persistence-catalog.zh.md)。以下词汇来自 [`packages/notes/notes/src/types.ts`](../../packages/notes/notes/src/types.ts)。

## 身份与词汇

`NoteId` 是作用于所属会话的[品牌化 id](core.zh.md#branded-ids)。颜色是固定的 noty 风格调色板，仅用于展示，从不进入模型请求。

```ts type-equiv
/**
 * Fixed note palette, noty-inspired. Colors are presentation vocabulary
 * only — they never reach a model request — and each theme resolves the
 * concrete values in the client stylesheet.
 */
type NoteColor =
  | 'yellow'
  | 'green'
  | 'blue'
  | 'pink'
  | 'purple'
  | 'gray'
```

```ts type-equiv
/** One user-owned sticky note of the owning session. */
interface NoteItem {
  /** Stable identity; assigned by the service at creation and never rewritten. */
  readonly id: NoteId
  /** Trimmed non-empty body text. */
  readonly text: string
  /** Presentation color; model-invisible. */
  readonly color: NoteColor
  /** Whether the note is pinned in the panel and import ordering. */
  readonly pinned: boolean
  /** Epoch milliseconds of creation; set once and never rewritten. */
  readonly createdAt: number
  /** Epoch milliseconds of the latest mutation; monotonic across the session's notes. */
  readonly updatedAt: number
}
```

```ts type-equiv
/**
 * The `notes` projection value: the session's current notes plus the
 * recorded model-context injection switch. Per-item rule: every `note/put`
 * upserts one note in place, `note/delete` removes one, and `note/inject`
 * flips the switch, so the fold is deterministic order-wise without a
 * whole-value rewrite.
 */
interface NotesState {
  /** Current notes in event order (insertion position; display ordering is a view concern). */
  readonly notes: readonly NoteItem[]
  /** Whether the `notes:context` system-prompt section is enabled. */
  readonly inject: boolean
}
```

## 请求与结果

```ts type-equiv
/** Remote request to create (no `id`) or replace one note. */
interface NotePutRequest {
  /** Existing note to replace; omitted on creation. */
  readonly id?: NoteId
  /** Replacement or initial body text; trimmed by the service. */
  readonly text: string
  /** Color; creation defaults to `'yellow'`, replacement keeps the current one when omitted. */
  readonly color?: NoteColor
  /** Pin state; creation defaults to `false`, replacement keeps the current one when omitted. */
  readonly pinned?: boolean
}
```

```ts type-equiv
/** Remote request naming the notes to import; omitted `ids` selects all. */
interface NoteImportRequest {
  /** Exact notes to import; every id must exist. */
  readonly ids?: readonly NoteId[]
}
```

```ts type-equiv
/** Wire-safe acknowledgement of one import-as-message. */
interface NoteImportResult {
  /** How many notes the composed message carried. */
  readonly count: number
}
```

## 服务行为

[`NoteService`](../../packages/notes/notes/src/index.ts)（`ctx.notes`）按需从会话日志折叠状态 —— 便签事件相对日志数量很少，且每次变更本就要支付一次持久追加。`put` 创建或按 id 替换一条便签（未知 id 追加，已知 id 原位替换），执行配置的 `maxNoteBytes` / `maxNotes` 上限，并将 `updatedAt` 对抗时钟回拨做钳制；`delete` 对未知 id 显式拒绝而非空操作；`setInject` 记录开关，记录状态已一致时跳过事件。`importAsMessage` 将选中的便签（置顶优先）组合为一条用户消息 steer。所有失败都是携带稳定 `notes-*` 代码的 `NoteError`；没有任何静默跳过。`notes` 投影单元向客户端提供整个 `NotesState`；`notes:context` 节（order 60）仅在记录的开关开启时渲染折叠便签 —— 关闭时节为空，因此注入状态仅凭日志即可重建。

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxnotes--noteservice"></a>

### `ctx.notes` — `NoteService`

Notes service (`ctx.notes`) backed exclusively by the owning session log. State is folded on demand: note events are few relative to a session log, and every mutation already pays a durable append, so the linear scan keeps the service stateless across log reloads without a live mirror.

```ts cordis-catalog
/**
 * Create one note (no `id`) or replace one existing note.
 * @param agent - owning live agent.
 * @param request - body text plus optional identity, color, and pin state.
 * @returns the committed item.
 * @throws {@link NoteError} on blank or oversized text, an unknown color or id, or a creation past `maxNotes`.
 */
@Remote('put') put(agent: Agent, request: NotePutRequest): NoteItem

/**
 * Delete one note by id.
 * @param agent - owning live agent.
 * @param id - the note to remove.
 * @throws {@link NoteError} when the id is unknown — never a silent no-op.
 */
@Remote('delete') delete(agent: Agent, id: NoteId): void

/**
 * Enable or disable the `notes:context` prompt section for this session.
 * The recorded state already matching is a no-op without a log event.
 * @param agent - owning live agent.
 * @param enabled - whether folded notes join each model request.
 */
@Remote('setInject') setInject(agent: Agent, enabled: boolean): void

/**
 * Import notes into the conversation as one user message: the selected
 * notes (all of them when `ids` is omitted) compose into a single
 * pinned-first steer that the model sees on its next turn.
 * @param agent - owning live agent.
 * @param request - optional exact ids; every named id must exist.
 * @returns how many notes the composed message carried.
 * @throws {@link NoteError} on an unknown id or when there is nothing to import.
 */
@Remote('import') importAsMessage(agent: Agent, request: NoteImportRequest): NoteImportResult
```

Types: [Agent](core.zh.md)

Source: [`packages/notes/notes/src/index.ts`](../../packages/notes/notes/src/index.ts)
<!-- END GENERATED cordis-surface -->
