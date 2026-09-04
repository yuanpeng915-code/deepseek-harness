/**
 * Pure types of the notes domain: the ONE home of the `notes` projection-key
 * declaration plus the durable payload vocabulary it carries, free of this
 * package's host-side imports (cordis events, dsh-agent, dsh-llm, the
 * service). Two namespace projections serve it — `./types` for host
 * consumers, `./client` (the browser half-entry's re-export) for client
 * aggregates — with zero content duplication.
 *
 * @module @deepseek-ai/dsh-notes/types
 */

import type { Branded } from '@deepseek-ai/dsh-brand'

/** Identifies one sticky note within its owning session. */
export type NoteId = Branded<'NoteId'>

/**
 * Fixed note palette, noty-inspired. Colors are presentation vocabulary
 * only — they never reach a model request — and each theme resolves the
 * concrete values in the client stylesheet.
 */
export type NoteColor =
  | 'yellow'
  | 'green'
  | 'blue'
  | 'pink'
  | 'purple'
  | 'gray'

/** One user-owned sticky note of the owning session. */
export interface NoteItem {
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

/**
 * The `notes` projection value: the session's current notes plus the
 * recorded model-context injection switch. Per-item rule: every `note/put`
 * upserts one note in place, `note/delete` removes one, and `note/inject`
 * flips the switch, so the fold is deterministic order-wise without a
 * whole-value rewrite.
 */
export interface NotesState {
  /** Current notes in event order (insertion position; display ordering is a view concern). */
  readonly notes: readonly NoteItem[]
  /** Whether the `notes:context` system-prompt section is enabled. */
  readonly inject: boolean
}

/** Remote request to create (no `id`) or replace one note. */
export interface NotePutRequest {
  /** Existing note to replace; omitted on creation. */
  readonly id?: NoteId
  /** Replacement or initial body text; trimmed by the service. */
  readonly text: string
  /** Color; creation defaults to `'yellow'`, replacement keeps the current one when omitted. */
  readonly color?: NoteColor
  /** Pin state; creation defaults to `false`, replacement keeps the current one when omitted. */
  readonly pinned?: boolean
}

/** Remote request naming the notes to import; omitted `ids` selects all. */
export interface NoteImportRequest {
  /** Exact notes to import; every id must exist. */
  readonly ids?: readonly NoteId[]
}

/** Wire-safe acknowledgement of one import-as-message. */
export interface NoteImportResult {
  /** How many notes the composed message carried. */
  readonly count: number
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    notes: NotesState
  }
  interface SessionProjectionMap {
    /**
     * The session's sticky notes and injection switch, folded from the
     * per-item `note/put` / `note/delete` / `note/inject` events. Notes keep
     * their insertion position on upsert; display ordering is a view concern.
     */
    notes: NotesState
  }
}
