/** Pure event fold, strict payload decoders, and model-facing renderers for the notes domain. */

import { NOTE_COLORS, NoteId } from './runtime.ts'
import type { NoteColor, NoteId as NoteIdType, NoteItem, NotesState } from './types.ts'

/**
 * Build the empty projection state.
 * @returns no notes and injection off — a fresh or prefix-folded log with no note events.
 */
export function emptyNotesState(): NotesState {
  return { notes: [], inject: false }
}

/** Whether a value is a JSON record rather than an array. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Require one non-negative safe integer. */
function nonNegativeInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`note payload ${field} must be a non-negative safe integer`)
  }
  return value
}

/**
 * Decode and validate one durable note item: exact field set, trimmed
 * non-empty text, palette color, and monotonicity within the item.
 * @param value - candidate `note/put` payload.
 * @returns the validated note.
 * @throws when the payload is not a canonical note item.
 */
export function decodeNoteItem(value: unknown): NoteItem {
  if (!isRecord(value)) throw new Error('note/put payload must be a record')
  if (Object.keys(value).sort().join(',') !== 'color,createdAt,id,pinned,text,updatedAt') {
    throw new Error('note/put payload must have exactly color, createdAt, id, pinned, text, updatedAt fields')
  }
  const { id, text, color, pinned, createdAt, updatedAt } = value
  if (typeof id !== 'string' || id.length === 0) throw new Error('note/put id must be a non-empty string')
  if (typeof text !== 'string' || text.length === 0 || text !== text.trim()) {
    throw new Error('note/put text must be non-empty and trimmed')
  }
  if (typeof color !== 'string' || !NOTE_COLORS.has(color as NoteColor)) {
    throw new Error(`note/put color must be one of ${[...NOTE_COLORS].join(', ')}`)
  }
  if (typeof pinned !== 'boolean') throw new Error('note/put pinned must be a boolean')
  const created = nonNegativeInteger(createdAt, 'createdAt')
  const updated = nonNegativeInteger(updatedAt, 'updatedAt')
  if (updated < created) throw new Error('note/put updatedAt cannot precede createdAt')
  return { id: NoteId(id), text, color: color as NoteColor, pinned, createdAt: created, updatedAt: updated }
}

/**
 * Decode one `note/delete` payload.
 * @param value - the appended payload record.
 * @returns the branded id of the deleted note.
 */
export function decodeNoteDelete(value: unknown): NoteIdType {
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'id') {
    throw new Error('note/delete payload must have exactly an id field')
  }
  const { id } = value
  if (typeof id !== 'string' || id.length === 0) throw new Error('note/delete id must be a non-empty string')
  return NoteId(id)
}

/**
 * Decode one `note/inject` payload.
 * @param value - the appended payload record.
 * @returns the recorded injection switch.
 */
export function decodeNoteInject(value: unknown): boolean {
  if (!isRecord(value) || Object.keys(value).sort().join(',') !== 'enabled') {
    throw new Error('note/inject payload must have exactly an enabled field')
  }
  if (typeof value['enabled'] !== 'boolean') throw new Error('note/inject enabled must be a boolean')
  return value['enabled']
}

/**
 * Projection-grade fold of one session event into the notes state. Malformed
 * note payloads return the same reference: the write side validated before
 * appending, and the package invariant rejects a violating stream fail-loud
 * where it is installed. Every non-note event returns the same reference.
 * @param state - the projection covering all prior events.
 * @param event - the next committed session event.
 * @returns the next projection (same reference when nothing applies).
 */
export function applyNoteEvent(state: NotesState, event: { type: string; data: unknown }): NotesState {
  if (event.type === 'note/put') {
    let note: NoteItem
    try {
      if (!isRecord(event.data) || Object.keys(event.data).sort().join(',') !== 'note') {
        throw new Error('note/put payload must have exactly a note field')
      }
      note = decodeNoteItem(event.data.note)
    } catch (_malformedPersistedNote) {
      return state
    }
    const index = state.notes.findIndex(existing => existing.id === note.id)
    const notes = [...state.notes]
    if (index === -1) notes.push(note)
    else notes[index] = note
    return { notes, inject: state.inject }
  }
  if (event.type === 'note/delete') {
    let id: NoteIdType
    try {
      id = decodeNoteDelete(event.data)
    } catch (_malformedPersistedDelete) {
      return state
    }
    const notes = state.notes.filter(existing => existing.id !== id)
    if (notes.length === state.notes.length) return state
    return { notes, inject: state.inject }
  }
  if (event.type === 'note/inject') {
    let enabled: boolean
    try {
      enabled = decodeNoteInject(event.data)
    } catch (_malformedPersistedInject) {
      return state
    }
    if (enabled === state.inject) return state
    return { notes: state.notes, inject: enabled }
  }
  return state
}

/**
 * Fold notes state from a contiguous session event log.
 * @param events - session events in sequence order.
 * @param end - fold `events[0, end)`; defaults to the whole log.
 * @returns a fresh notes projection.
 */
export function foldNotes(events: readonly { type: string; data: unknown }[], end = events.length): NotesState {
  let state = emptyNotesState()
  let index = 0
  for (const event of events) {
    if (index >= end) break
    index++
    state = applyNoteEvent(state, event)
  }
  return state
}

/**
 * Display ordering shared by the panel and the model-facing renderers:
 * oldest created first — the top-to-bottom queue order — with the id as the
 * stable tiebreak. Pin state never reorders.
 * @param notes - notes in event order.
 * @returns the ordered copy.
 */
export function orderNotesForDisplay(notes: readonly NoteItem[]): readonly NoteItem[] {
  return [...notes].sort((left, right) =>
    left.createdAt !== right.createdAt
      ? left.createdAt - right.createdAt
      : left.id < right.id ? -1 : 1,
  )
}

/**
 * Render the notes body shared by the import message and the prompt section:
 * one bullet per note, oldest created first, with a `[pinned]` marker.
 * @param notes - notes in event order.
 * @returns the bullet body without any preamble, or `''` with no notes.
 */
function renderBullets(notes: readonly NoteItem[]): string {
  if (notes.length === 0) return ''
  return orderNotesForDisplay(notes)
    .map(note => `- ${note.pinned ? '[pinned] ' : ''}${note.text}`)
    .join('\n')
}

/**
 * Render the `notes:context` system-prompt section text. Empty whenever
 * execution is off or no notes exist, so the section only ever replaces the
 * prompt prefix with user-recorded content.
 * @param state - the session's folded notes state.
 * @returns the section text or `''` when nothing applies.
 */
export function renderNotesSection(state: NotesState): string {
  if (!state.inject || state.notes.length === 0) return ''
  return `The user's sticky notes for this conversation (oldest first):\n\n${renderBullets(state.notes)}`
}

/**
 * Compose the one-shot import message body for "send notes into the
 * conversation": the same oldest-first bullets under an explicit preamble.
 * @param notes - the selected notes in event order.
 * @returns the user-message text.
 */
export function composeImportText(notes: readonly NoteItem[]): string {
  return `Here are my sticky notes to bring into this conversation:\n\n${renderBullets(notes)}`
}
