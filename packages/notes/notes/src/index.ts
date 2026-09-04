/**
 * Session-scoped sticky notes: a user-owned per-conversation scratchpad whose
 * durable state lives entirely in the session log. The service exposes the
 * panel's mutation verbs (put, delete, pin through put, color through put)
 * plus the task-execution switch, and contributes the optional `notes:context`
 * system-prompt section that folds the recorded notes into each model request
 * while execution is on. When execution is on, the service runs the queue
 * itself: after each settled turn the oldest note is steered in as one user
 * message and removed, until the queue empties and the switch records itself
 * off. Notes reach the model only through the two seams — the one-shot
 * `import` steer and the section — so nothing model-visible exists outside
 * the recorded `note/*` events.
 *
 * @module @deepseek-ai/dsh-notes
 */

import { Buffer } from 'node:buffer'
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { z as zod } from 'zod'
import type { ZodType } from 'zod'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Session } from '@deepseek-ai/dsh-session'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Type-only: resolves ctx.sessionProjections for the optional unit child.
import type {} from '@deepseek-ai/dsh-session-projection'
// Type-only: resolves ctx.systemPrompt for the optional section child.
import type {} from '@deepseek-ai/dsh-system-prompt'
import { applyNoteEvent, composeImportText, foldNotes, orderNotesForDisplay, renderNotesSection } from './fold.ts'
import { DEFAULT_NOTE_COLOR, newNoteId, NOTE_COLORS, NoteError } from './runtime.ts'
import type {
  NoteColor,
  NoteId,
  NoteImportRequest,
  NoteImportResult,
  NoteItem,
  NotePutRequest,
  NotesState,
} from './types.ts'

// The `notes` projection-key declaration lives in src/types.ts (its one
// home); this re-export projects the type face onto the package root AND
// keeps the module edge in the emitted index.d.ts, so aggregate programs
// consuming the declarations still receive the SessionProjectionMap merge.
export type * from './types.ts'
export { decodeNoteDelete, decodeNoteInject, decodeNoteItem, foldNotes, orderNotesForDisplay, renderNotesSection } from './fold.ts'
export { NoteError, NoteId, NOTE_COLORS } from './runtime.ts'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * One note created or replaced by id: log-only, non-surface, per-item
     * upsert. The payload is the whole post-write item; an unknown id appends
     * at the end, a known id replaces in place. Carries the note's color and
     * pin state so the fold needs no other write event.
     */
    'note/put': { note: NoteItem }
    /**
     * One note removed by id: log-only, non-surface. Deleting an absent id
     * changes nothing on replay; the service rejects it before appending.
     */
    'note/delete': { id: NoteId }
    /**
     * Whether automatic note-task execution is on: after each settled turn
     * the oldest note is delivered as one user message and removed, until
     * the queue empties and the switch records itself off. The last
     * `note/inject` wins; a log with none folds to off.
     */
    'note/inject': { enabled: boolean }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    notes: NoteService
  }
}

/** Deployment policy for the notes service; omitted keys take the defaults. */
export interface Config {
  /** Maximum UTF-8 byte length accepted for one note body. */
  maxNoteBytes?: number
  /** Maximum number of notes retained per session (creation is rejected beyond it). */
  maxNotes?: number
}

/** Resolved deployment policy. */
interface ResolvedConfig {
  maxNoteBytes: number
  maxNotes: number
}

/** Validate the one deployment-varying body limit at the configuration boundary. */
function resolveMaxNoteBytes(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`notes: maxNoteBytes must be a positive safe integer, got ${String(value)}`)
  }
  return value
}

/** Validate the one deployment-varying count limit at the configuration boundary. */
function resolveMaxNotes(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new TypeError(`notes: maxNotes must be a positive safe integer, got ${String(value)}`)
  }
  return value
}

/** Validate and normalize one note body against the configured byte bound. */
function resolveText(value: string, maxNoteBytes: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new NoteError('note text must be a non-empty string', 'notes-invalid-text')
  }
  const text = value.trim()
  const actualBytes = Buffer.byteLength(text, 'utf8')
  if (actualBytes > maxNoteBytes) {
    throw new NoteError(
      `note text is ${actualBytes} UTF-8 bytes; the limit is ${maxNoteBytes}`,
      'notes-invalid-text',
    )
  }
  return text
}

/** Validate one explicit color request. */
function resolveColor(value: NoteColor): NoteColor {
  if (!NOTE_COLORS.has(value)) {
    throw new NoteError(`note color must be one of ${[...NOTE_COLORS].join(', ')}`, 'notes-invalid-color')
  }
  return value
}

/** Wire payload schema of the `notes` projection (the unit state and the view are the same shape). */
const notesStateSchema: ZodType<NotesState> = zod.object({
  notes: zod.array(zod.object({
    id: zod.string().min(1),
    text: zod.string().min(1),
    color: zod.union([
      zod.literal('yellow'),
      zod.literal('green'),
      zod.literal('blue'),
      zod.literal('pink'),
      zod.literal('purple'),
      zod.literal('gray'),
    ]),
    pinned: zod.boolean(),
    createdAt: zod.number(),
    updatedAt: zod.number(),
  })),
  inject: zod.boolean(),
}) as unknown as ZodType<NotesState>

/**
 * Notes service (`ctx.notes`) backed exclusively by the owning session log.
 * State is folded on demand: note events are few relative to a session log,
 * and every mutation already pays a durable append, so the linear scan keeps
 * the service stateless across log reloads without a live mirror.
 */
export class NoteService extends TypertRemoteService {
  static inject = ['agents']

  static Config: z<Config> = z.object({
    maxNoteBytes: z.number().step(1).min(1).default(4096),
    maxNotes: z.number().step(1).min(1).default(100),
  })

  private readonly resolved: ResolvedConfig

  /**
   * @param ctx - Host context carrying the live agent registry.
   * @param config - Deployment policy; omitted keys take the validated defaults.
   */
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'notes')
    this.resolved = {
      maxNoteBytes: resolveMaxNoteBytes(config.maxNoteBytes ?? 4096),
      maxNotes: resolveMaxNotes(config.maxNotes ?? 100),
    }
    // The `notes` projection unit: per-item fold serving clients the whole
    // NotesState (see applyNoteEvent). The unit child activates only when a
    // projection registry is composed (headless assemblies stay unaffected).
    ctx.inject(['sessionProjections'], (projectionCtx) => {
      projectionCtx.sessionProjections.register<'notes', NotesState>({
        key: 'notes',
        stateSchema: notesStateSchema,
        init: () => ({ notes: [], inject: false }),
        apply: applyNoteEvent,
        wire: { viewSchema: notesStateSchema, view: state => state },
        stateVersion: 1,
      })
    })
    // The injection section: the folded notes replace the section text only
    // while the recorded switch is on. The child activates only when a
    // system-prompt registry is composed.
    ctx.inject(['systemPrompt'], (promptCtx) => {
      promptCtx.systemPrompt.section({
        name: 'notes:context',
        order: 60,
        text: (context) => {
          if (context.agent === undefined) return ''
          return renderNotesSection(this.stateOf(context.agent.session))
        },
      })
    })
    // The execution listener: when an agent's loop settles and the recorded
    // switch is on, the oldest note becomes the next task — one user message
    // per settled turn, until the queue empties and the switch turns off.
    ctx.on('agent/status', ({ agent, status }) => {
      if (status !== 'idle') return
      this.executeNextNote(agent)
    })
  }

  /**
   * Create one note (no `id`) or replace one existing note.
   * @param agent - owning live agent.
   * @param request - body text plus optional identity, color, and pin state.
   * @returns the committed item.
   * @throws {@link NoteError} on blank or oversized text, an unknown color or id, or a creation past `maxNotes`.
   */
  @Remote('put')
  put(agent: Agent, request: NotePutRequest): NoteItem {
    this.assertLive(agent)
    const text = resolveText(request.text, this.resolved.maxNoteBytes)
    const color = request.color === undefined ? undefined : resolveColor(request.color)
    const state = this.stateOf(agent.session)
    if (request.id === undefined) {
      if (state.notes.length >= this.resolved.maxNotes) {
        throw new NoteError(
          `the session already holds ${this.resolved.maxNotes} notes; delete one before adding another`,
          'notes-limit-reached',
        )
      }
      const now = Date.now()
      const note: NoteItem = {
        id: newNoteId(),
        text,
        color: color ?? DEFAULT_NOTE_COLOR,
        pinned: request.pinned ?? false,
        createdAt: now,
        updatedAt: now,
      }
      agent.session.append('note/put', { note })
      return note
    }
    const existing = state.notes.find(note => note.id === request.id)
    if (existing === undefined) {
      throw new NoteError(`note "${request.id}" does not exist in this session`, 'notes-not-found')
    }
    const note: NoteItem = {
      id: existing.id,
      text,
      color: color ?? existing.color,
      pinned: request.pinned ?? existing.pinned,
      createdAt: existing.createdAt,
      updatedAt: this.nextMutationTime(state),
    }
    agent.session.append('note/put', { note })
    return note
  }

  /**
   * Delete one note by id. Removing the last note while execution is on
   * records the switch off, so the queue can never rest enabled and empty.
   * @param agent - owning live agent.
   * @param id - the note to remove.
   * @throws {@link NoteError} when the id is unknown — never a silent no-op.
   */
  @Remote('delete')
  delete(agent: Agent, id: NoteId): void {
    this.assertLive(agent)
    const state = this.stateOf(agent.session)
    if (!state.notes.some(note => note.id === id)) {
      throw new NoteError(`note "${id}" does not exist in this session`, 'notes-not-found')
    }
    agent.session.append('note/delete', { id })
    const next = this.stateOf(agent.session)
    if (next.inject && next.notes.length === 0) {
      agent.session.append('note/inject', { enabled: false })
    }
  }

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
  @Remote('setInject')
  setInject(agent: Agent, enabled: boolean): void {
    this.assertLive(agent)
    const state = this.stateOf(agent.session)
    if (state.inject === enabled) return
    if (enabled && state.notes.length === 0) {
      throw new NoteError('there are no notes to execute; add one before enabling', 'notes-nothing-to-import')
    }
    agent.session.append('note/inject', { enabled })
    if (enabled && agent.status === 'idle') this.executeNextNote(agent)
  }

  /**
   * Import notes into the conversation as one user message: the selected
   * notes (all of them when `ids` is omitted) compose into a single
   * oldest-first steer that the model sees on its next turn.
   * @param agent - owning live agent.
   * @param request - optional exact ids; every named id must exist.
   * @returns how many notes the composed message carried.
   * @throws {@link NoteError} on an unknown id or when there is nothing to import.
   */
  @Remote('import')
  importAsMessage(agent: Agent, request: NoteImportRequest): NoteImportResult {
    this.assertLive(agent)
    const state = this.stateOf(agent.session)
    const selected = request.ids === undefined
      ? [...state.notes]
      : request.ids.map((id) => {
        const note = state.notes.find(entry => entry.id === id)
        if (note === undefined) {
          throw new NoteError(`note "${id}" does not exist in this session`, 'notes-not-found')
        }
        return note
      })
    if (selected.length === 0) {
      throw new NoteError('there are no notes to import into this conversation', 'notes-nothing-to-import')
    }
    agent.steer(createUserMessage({
      content: [{ type: 'text', text: composeImportText(selected) }],
      source: { kind: 'user' },
    }))
    return { count: selected.length }
  }

  /** Reject stale or missing live-agent identity rather than trusting a matching id. */
  private assertLive(agent: Agent): void {
    if (this.ctx.agents.get(agent.id) !== agent) {
      throw new NoteError(`agent "${agent.id}" is not live in this registry`, 'notes-not-found')
    }
  }

  /**
   * Deliver the queue's oldest note as the next task, one note per settled
   * turn: record the deletion, record the switch off when the queue drained,
   * then steer the note text so the loop starts the turn. No-op unless the
   * agent is live, the switch is on, and notes remain.
   * @param agent - the agent whose loop just settled (or that just enabled the switch).
   */
  private executeNextNote(agent: Agent): void {
    if (this.ctx.agents.get(agent.id) !== agent) return
    const state = this.stateOf(agent.session)
    if (!state.inject) return
    const next = orderNotesForDisplay(state.notes)[0]
    if (next === undefined) {
      agent.session.append('note/inject', { enabled: false })
      return
    }
    agent.session.append('note/delete', { id: next.id })
    if (state.notes.length === 1) {
      agent.session.append('note/inject', { enabled: false })
    }
    agent.steer(createUserMessage({
      content: [{ type: 'text', text: next.text }],
      source: { kind: 'user' },
    }))
  }

  /** Fold the session's current notes state from its durable log. */
  private stateOf(session: Session): NotesState {
    return foldNotes(session.events)
  }

  /** Clamp a note's next timestamp across backward wall-clock movement. */
  private nextMutationTime(state: NotesState): number {
    return state.notes.reduce((latest, note) => Math.max(latest, note.updatedAt), Date.now())
  }
}

export default NoteService
