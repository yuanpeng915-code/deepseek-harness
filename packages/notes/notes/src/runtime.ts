/** Runtime constructors and validation vocabulary for the notes domain. */

import { randomUUID } from 'node:crypto'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import type { NoteColor, NoteId } from './types.ts'

/** The fixed note palette as a runtime-checkable set. */
export const NOTE_COLORS: ReadonlySet<NoteColor> = new Set([
  'yellow',
  'green',
  'blue',
  'pink',
  'purple',
  'gray',
])

/** Color assigned to a created note whose request omitted one. */
export const DEFAULT_NOTE_COLOR: NoteColor = 'yellow'

/**
 * Brand a string as a note id.
 * @param id - raw note identifier.
 * @returns the same string with the compile-time brand.
 */
export function NoteId(id: string): NoteId {
  return id as NoteId
}

/**
 * Mint one fresh note id.
 * @returns a new opaque, unique note id.
 */
export function newNoteId(): NoteId {
  return NoteId(`note-${randomUUID()}`)
}

/** Stable machine-routable failure classifications of the notes boundary. */
export type NoteErrorCode =
  | 'notes-invalid-text'
  | 'notes-invalid-color'
  | 'notes-not-found'
  | 'notes-limit-reached'
  | 'notes-nothing-to-import'

/** Error thrown at the notes service boundary. */
export class NoteError extends HarnessError {
  /**
   * @param message - human-readable rejection reason.
   * @param code - stable machine-routable classification.
   */
  // Keep the constructor to narrow HarnessError's string code at this boundary.
  // oxlint-disable-next-line typescript/no-useless-constructor -- type-only narrowing
  constructor(message: string, code: NoteErrorCode) {
    super(message, code)
  }
}
