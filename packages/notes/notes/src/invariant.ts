/** Package-owned durable note-stream invariants. @module @deepseek-ai/dsh-notes/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantFailure, InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import {
  decodeNoteDelete,
  decodeNoteInject,
  decodeNoteItem,
} from './fold.ts'
import type { NoteItem } from './types.ts'

const PACKAGE_NAME = '@deepseek-ai/dsh-notes'

/** Cordis companion plugin name. */
export const name = 'notes-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** Mutable per-session validation state kept private to the installer. */
interface NoteStreamState {
  readonly notesById: Map<string, NoteItem>
  lastTimestamp: number
}

/** Build the empty validation state. */
function emptyStreamState(): NoteStreamState {
  return { notesById: new Map(), lastTimestamp: 0 }
}

/**
 * Validate one candidate note event against the preceding stream state:
 * canonical payload shape, preserved identity and creation time on update,
 * and timestamp monotonicity across the session's notes.
 */
function applyChecked(state: NoteStreamState, event: SessionEvent, fail: InvariantFailure): void {
  if (event.type === 'note/put') {
    let note: NoteItem
    try {
      note = decodeNoteItem(event.data.note)
    } catch (error) {
      fail(`session event ${event.seq} violates the durable note stream: ${(error as Error).message}`)
      return
    }
    const existing = state.notesById.get(note.id)
    if (existing === undefined) {
      if (note.createdAt !== note.updatedAt) {
        fail(`session event ${event.seq} creates note "${note.id}" with unequal createdAt and updatedAt`)
        return
      }
    } else {
      if (note.createdAt !== existing.createdAt) {
        fail(`session event ${event.seq} rewrites note "${note.id}" createdAt`)
        return
      }
      if (note.updatedAt < existing.updatedAt) {
        fail(`session event ${event.seq} moves note "${note.id}" updatedAt backwards`)
        return
      }
    }
    if (note.updatedAt < state.lastTimestamp) {
      fail(`session event ${event.seq} moves the note stream timestamp backwards`)
      return
    }
    state.notesById.set(note.id, note)
    state.lastTimestamp = note.updatedAt
    return
  }
  if (event.type === 'note/delete') {
    let id: string
    try {
      id = decodeNoteDelete(event.data)
    } catch (error) {
      fail(`session event ${event.seq} violates the durable note stream: ${(error as Error).message}`)
      return
    }
    if (!state.notesById.delete(id)) {
      fail(`session event ${event.seq} deletes unknown note "${id}"`)
    }
    return
  }
  if (event.type === 'note/inject') {
    try {
      decodeNoteInject(event.data)
    } catch (error) {
      fail(`session event ${event.seq} violates the durable note stream: ${(error as Error).message}`)
    }
  }
}

/** Install an independent incremental validation fold over every attached session. */
const install: InvariantInstaller = Object.assign((ctx: Context, fail: InvariantFailure) => {
  const states = new WeakMap<Session, NoteStreamState>()
  const staged = new WeakMap<SessionEvent, { session: Session; state: NoteStreamState }>()

  const seed = (session: Session): NoteStreamState => {
    const state = emptyStreamState()
    for (const event of session.events) applyChecked(state, event, fail)
    states.set(session, state)
    return state
  }
  /* v8 ignore next -- session/event always follows list() or session/created seeding */
  const stateFor = (session: Session): NoteStreamState => states.get(session) ?? seed(session)

  for (const session of ctx.sessions.list()) seed(session)
  ctx.on('session/created', (session) => { seed(session) }, { global: true })
  ctx.on('internal/dispatch', (_mode, eventName, args) => {
    if (eventName !== 'session/event') return
    const [session, event] = args as [Session, SessionEvent]
    const prior = stateFor(session)
    const state = { notesById: new Map(prior.notesById), lastTimestamp: prior.lastTimestamp }
    applyChecked(state, event, fail)
    staged.set(event, { session, state })
  }, { global: true })
  ctx.on('session/event', (session, event) => {
    const candidate = staged.get(event)
    /* v8 ignore next 2 -- internal/dispatch stages the exact callback arguments */
    if (candidate === undefined || candidate.session !== session) {
      return fail('session/event reached publication without matching note-stream validation')
    }
    staged.delete(event)
    states.set(session, candidate.state)
  }, { global: true })
}, { inject: ['sessions'] })

/**
 * Register the note-stream invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
