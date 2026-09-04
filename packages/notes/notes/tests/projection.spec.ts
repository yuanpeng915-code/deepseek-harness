/**
 * The `notes` projection unit: mounting dsh-notes beside the registry serves
 * the whole NotesState on the session snapshot with a consistent asOfSeq; a
 * composition without the service has no `notes` key; unmounting it removes
 * the key (HMR safety).
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import NoteService from '../src/index.ts'
import { NoteId } from '../src/runtime.ts'
import type { NoteItem } from '../src/types.ts'

let sequence = 0

/** Build one canonical note payload. */
function makeNote(text: string, overrides: Partial<NoteItem> = {}): NoteItem {
  sequence += 1
  return {
    id: NoteId(`note-${sequence}`),
    text,
    color: 'yellow',
    pinned: false,
    createdAt: 1000 + sequence,
    updatedAt: 1000 + sequence,
    ...overrides,
  }
}

interface Bench {
  ctx: Context
  session: Session
  notes(): { asOfSeq: number; values: Record<string, unknown> }
}

async function harness(withNotes: boolean, config: { maxNoteBytes?: number; maxNotes?: number } = {}): Promise<Bench> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(SessionProjectionRegistry)
  if (withNotes) await ctx.plugin(NoteService, config)
  const session = ctx.sessions.create(SessionId(`notes-proj-${Math.random()}`))
  ctx.agents.register({ id: session.id, session, status: 'idle', ctx } as Agent)
  return {
    ctx,
    session,
    notes() {
      const snapshot = ctx.sessionProjections.snapshot(session)
      return { asOfSeq: snapshot.asOfSeq, values: snapshot.values }
    },
  }
}

describe('notes projection unit', () => {
  it('serves the empty state before any note event', async () => {
    const bench = await harness(true)
    expect(bench.notes().values.notes).toEqual({ notes: [], inject: false })
    expect(bench.notes().asOfSeq).toBe(bench.session.seq - 1)
  })

  it('folds put, delete, and inject events with asOfSeq = last event seq', async () => {
    const bench = await harness(true)
    const session = bench.session
    const first = makeNote('first')
    session.append('note/put', { note: first })
    const second = makeNote('second', { color: 'green' })
    session.append('note/put', { note: second })
    session.append('note/inject', { enabled: true })
    const state = bench.notes().values.notes as { notes: NoteItem[]; inject: boolean }
    expect(state.notes).toEqual([first, second])
    expect(state.inject).toBe(true)
    expect(bench.notes().asOfSeq).toBe(session.seq - 1)

    session.append('note/put', { note: { ...first, text: 'rewritten', updatedAt: 9_999 } })
    session.append('note/delete', { id: second.id })
    const after = bench.notes().values.notes as { notes: NoteItem[]; inject: boolean }
    expect(after.notes).toEqual([{ ...first, text: 'rewritten', updatedAt: 9_999 }])
    expect(after.inject).toBe(true)
  })

  it('has no notes key when the service is not composed', async () => {
    const bench = await harness(false)
    expect(bench.notes().values).not.toHaveProperty('notes')
  })

  it('drops the key when the service fiber unloads (HMR safety)', async () => {
    const bench = await harness(false)
    const fiber = await bench.ctx.plugin(NoteService, {})
    expect(bench.notes().values.notes).toEqual({ notes: [], inject: false })
    await fiber.dispose()
    expect(bench.notes().values).not.toHaveProperty('notes')
  })
})
