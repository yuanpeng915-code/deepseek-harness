/** Note-stream invariant coverage: acceptance, rejection before commit, and late-load reconstruction. */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import * as NotesInvariantCompanion from '@deepseek-ai/dsh-notes/invariant'
import { NoteId } from '../src/runtime.ts'
import type { NoteItem } from '../src/types.ts'
import InvariantRegistry, { InvariantError } from '@deepseek-ai/dsh-invariants'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'

/** Build one canonical note payload. */
function note(overrides: Partial<NoteItem> = {}): NoteItem {
  return {
    id: NoteId('note-a'),
    text: 'canonical',
    color: 'yellow',
    pinned: false,
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  }
}

async function setup(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(InvariantRegistry, { enabled: true })
  await ctx.plugin(NotesInvariantCompanion)
  return ctx
}

describe('note stream invariants', () => {
  it('accepts a canonical put, update, delete, and inject sequence', async () => {
    const ctx = await setup()
    const session = ctx.sessions.create(SessionId('notes-invariant-valid'))
    session.append('note/put', { note: note() })
    session.append('note/put', { note: note({ text: 'rewritten', updatedAt: 200 }) })
    session.append('note/inject', { enabled: true })
    session.append('note/delete', { id: NoteId('note-a') })
    expect(session.seq).toBe(4)
  })

  it('rejects a malformed note/put before committing and keeps the fold reusable', async () => {
    const ctx = await setup()
    const session = ctx.sessions.create(SessionId('notes-invariant-invalid'))
    expect(() => {
      session.append('note/put', { note: { ...note(), color: 'orange' } } as never)
    }).toThrow(expect.objectContaining<Partial<InvariantError>>({
      code: 'INVARIANT',
      packageName: '@deepseek-ai/dsh-notes',
    }))
    expect(session.seq).toBe(0)
    session.append('note/put', { note: note() })
    expect(session.seq).toBe(1)
  })

  it('rejects a delete of an unknown id and a createdAt rewrite', async () => {
    const ctx = await setup()
    const session = ctx.sessions.create(SessionId('notes-invariant-relations'))
    session.append('note/put', { note: note() })
    expect(() => {
      session.append('note/delete', { id: NoteId('note-missing') })
    }).toThrow(InvariantError)
    expect(() => {
      session.append('note/put', { note: note({ createdAt: 101, updatedAt: 300 }) })
    }).toThrow('rewrites note "note-a" createdAt')
    expect(() => {
      session.append('note/put', { note: note({ id: NoteId('note-b'), createdAt: 100, updatedAt: 200 }) })
    }).toThrow('unequal createdAt and updatedAt')
  })

  it('rejects a timestamp moving backwards across notes', async () => {
    const ctx = await setup()
    const session = ctx.sessions.create(SessionId('notes-invariant-clock'))
    session.append('note/put', { note: note({ createdAt: 500, updatedAt: 500 }) })
    expect(() => {
      session.append('note/put', { note: note({ id: NoteId('note-b'), createdAt: 200, updatedAt: 200 }) })
    }).toThrow('timestamp backwards')
  })

  it('reconstructs an existing durable stream before checking later events', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    const session = ctx.sessions.create(SessionId('notes-invariant-late-load'))
    session.append('note/put', { note: note() })

    await ctx.plugin(InvariantRegistry, { enabled: true })
    await ctx.plugin(NotesInvariantCompanion)
    session.append('note/delete', { id: NoteId('note-a') })
    expect(session.seq).toBe(2)
  })
})
