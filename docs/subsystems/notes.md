# Session sticky notes

English | [中文](notes.zh.md)

Per-conversation sticky notes owned by the human user: a scratchpad the web panel edits and the model reads only through the two import paths — the one-shot `import` steer and the optional `notes:context` prompt section. Durable state lives entirely in the owning session log as per-item `note/put` / `note/delete` / `note/inject` events; the [persistence catalog](../persistence-catalog.md) carries the event reference. The vocabulary below comes from [`packages/notes/notes/src/types.ts`](../../packages/notes/notes/src/types.ts).

## Identity and vocabulary

`NoteId` is a [branded id](core.md#branded-ids) scoped to its owning session. Colors are a fixed, noty-inspired palette used only for presentation; they never reach a model request.

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
  /** Whether the note carries the `[pinned]` marker in model-facing bullet bodies; ordering ignores it. */
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
 * recorded task-execution switch. Per-item rule: every `note/put`
 * upserts one note in place, `note/delete` removes one, and `note/inject`
 * flips the switch, so the fold is deterministic order-wise without a
 * whole-value rewrite.
 */
interface NotesState {
  /** Current notes in event order (insertion position; display ordering is a view concern). */
  readonly notes: readonly NoteItem[]
  /**
   * Whether automatic note-task execution is enabled: after each settled
   * turn the oldest note is delivered as a user message and removed, until
   * the queue empties and the switch records itself off.
   */
  readonly inject: boolean
}
```

## Requests and results

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

## Service behavior

[`NoteService`](../../packages/notes/notes/src/index.ts) (`ctx.notes`) folds state on demand from the session log — note events are few relative to a log, and every mutation already pays a durable append. `put` creates or replaces one note (an unknown id appends, a known id replaces in place), enforces the configured `maxNoteBytes` / `maxNotes` bounds, and clamps `updatedAt` against backward wall-clock movement; `delete` rejects an unknown id instead of no-oping; `setInject` records the switch, refuses to enable an empty queue, and executes the first note immediately when the loop is idle; it skips the event when the recorded state already matches. `importAsMessage` composes the selected notes (oldest created first) into one user-message steer. While the switch is on, the service runs the queue: after each settled turn the oldest note is steered in as one user message and removed, and an emptied queue records the switch off. Every failure is a `NoteError` with a stable `notes-*` code; nothing is silently skipped. The `notes` projection unit serves clients the whole `NotesState`, and the `notes:context` section (order 60) renders the folded notes only while the recorded switch is on — an off switch leaves the section empty, so injection state is reconstructable from the log alone.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

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
 * Delete one note by id. Removing the last note while execution is on
 * records the switch off, so the queue can never rest enabled and empty.
 * @param agent - owning live agent.
 * @param id - the note to remove.
 * @throws {@link NoteError} when the id is unknown — never a silent no-op.
 */
@Remote('delete') delete(agent: Agent, id: NoteId): void

/**
 * Enable or disable automatic note-task execution. Enabling an empty queue
 * is refused — there is no task to run. Enabling while the loop is idle
 * executes the first note immediately; enabling mid-turn hands the queue to
 * the settle listener. The recorded state already matching is a no-op
 * without a log event.
 * @param agent - owning live agent.
 * @param enabled - whether settled turns drain the note queue.
 * @throws {@link NoteError} when enabling with no notes recorded.
 */
@Remote('setInject') setInject(agent: Agent, enabled: boolean): void

/**
 * Import notes into the conversation as one user message: the selected
 * notes (all of them when `ids` is omitted) compose into a single
 * oldest-first steer that the model sees on its next turn.
 * @param agent - owning live agent.
 * @param request - optional exact ids; every named id must exist.
 * @returns how many notes the composed message carried.
 * @throws {@link NoteError} on an unknown id or when there is nothing to import.
 */
@Remote('import') importAsMessage(agent: Agent, request: NoteImportRequest): NoteImportResult
```

Types: [Agent](core.md)

Source: [`packages/notes/notes/src/index.ts`](../../packages/notes/notes/src/index.ts)
<!-- END GENERATED cordis-surface -->
