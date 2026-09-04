/**
 * NoteService behavior over a real session log: creation and replacement
 * semantics, byte/count limits, explicit failures, the injection switch, and
 * the import-as-message steer. Agent steering is recorded through a
 * registry-compatible stub agent.
 */

import { describe, expect, it, vi, afterEach } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry, { Inbox } from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import SessionStore, { Session, SessionId, type UserMessage } from '@deepseek-ai/dsh-session'
import NoteService, { NoteError } from '../src/index.ts'
import type { NoteItem, NotesState } from '../src/types.ts'

interface StubAgent {
  agent: Agent
  session: Session
  steered: UserMessage[]
}

/** Build a registry-compatible agent around a fresh session, recording steers. */
function stubAgent(rawId: string): StubAgent {
  const session = Session.create(SessionId(rawId))
  const steered: UserMessage[] = []
  const inbox = new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} })
  const agent: Agent = {
    id: session.id,
    options: {},
    session,
    inbox,
    ctx: new Context(),
    status: 'idle',
    send: () => {},
    followup: () => {},
    steer: (message: UserMessage) => { steered.push(message) },
    inject(input) { inbox.append('next-step', input) },
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle() { return Promise.resolve() },
  }
  return { agent, session, steered }
}

interface Bench {
  ctx: Context
  agent: Agent
  session: Session
  steered: UserMessage[]
  /** The session's folded notes state, read back through the service's own fold. */
  state(): NotesState
}

async function harness(config: { maxNoteBytes?: number; maxNotes?: number } = {}): Promise<Bench> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(NoteService, config)
  const stub = stubAgent(`notes-test-${Math.random()}`)
  ctx.agents.register(stub.agent)
  return {
    ctx,
    ...stub,
    state(): NotesState {
      const events = stub.session.events
      let notes: NoteItem[] = []
      let inject = false
      for (const event of events) {
        if (event.type === 'note/put') {
          const note = event.data.note
          const index = notes.findIndex(entry => entry.id === note.id)
          if (index === -1) notes.push(note)
          else notes[index] = note
        }
        if (event.type === 'note/delete') notes = notes.filter(entry => entry.id !== event.data.id)
        if (event.type === 'note/inject') inject = event.data.enabled
      }
      return { notes, inject }
    },
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('NoteService put', () => {
  it('creates a note with the defaults and appends one note/put', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    const bench = await harness()
    const created = bench.ctx.notes.put(bench.agent, { text: '  buy milk  ', color: 'green', pinned: true })
    expect(created).toMatchObject({
      text: 'buy milk',
      color: 'green',
      pinned: true,
      createdAt: 1_700_000_000_000,
      updatedAt: 1_700_000_000_000,
    })
    expect(created?.id).toMatch(/^note-/)
    expect(bench.state()).toEqual({ notes: [created], inject: false })
    expect(bench.session.events.at(-1)?.type).toBe('note/put')
  })

  it('defaults color to yellow and pin to false', async () => {
    const bench = await harness()
    const created = bench.ctx.notes.put(bench.agent, { text: 'idea' })
    expect(created.color).toBe('yellow')
    expect(created.pinned).toBe(false)
  })

  it('rejects blank text and text past the configured byte bound', async () => {
    const bench = await harness({ maxNoteBytes: 8 })
    expect(() => bench.ctx.notes.put(bench.agent, { text: '   ' })).toThrow(NoteError)
    try {
      bench.ctx.notes.put(bench.agent, { text: '研发便签' })
      expect.unreachable('oversized multibyte text must throw')
    } catch (error) {
      expect((error as HarnessError).code).toBe('notes-invalid-text')
      expect((error as Error).message).toContain('12 UTF-8 bytes')
    }
  })

  it('rejects an unknown color', async () => {
    const bench = await harness()
    try {
      bench.ctx.notes.put(bench.agent, { text: 'idea', color: 'orange' as never })
      expect.unreachable('unknown color must throw')
    } catch (error) {
      expect((error as HarnessError).code).toBe('notes-invalid-color')
    }
  })

  it('replaces an existing note, preserving createdAt and defaulting untouched fields', async () => {
    const bench = await harness()
    const created = bench.ctx.notes.put(bench.agent, { text: 'first', color: 'blue', pinned: true })
    const replaced = bench.ctx.notes.put(bench.agent, { id: created.id, text: 'second' })
    expect(replaced).toMatchObject({ id: created.id, text: 'second', color: 'blue', pinned: true })
    expect(replaced.createdAt).toBe(created.createdAt)
    expect(replaced.updatedAt).toBeGreaterThanOrEqual(created.updatedAt)
    expect(bench.state().notes).toHaveLength(1)
  })

  it('rejects a replacement of an unknown id without appending', async () => {
    const bench = await harness()
    try {
      bench.ctx.notes.put(bench.agent, { id: NoteOf('note-missing'), text: 'ghost' })
      expect.unreachable('unknown id must throw')
    } catch (error) {
      expect((error as HarnessError).code).toBe('notes-not-found')
    }
    expect(bench.session.events.filter(event => event.type.startsWith('note/'))).toHaveLength(0)
  })

  it('enforces maxNotes on creation but not on replacement', async () => {
    const bench = await harness({ maxNotes: 2 })
    const first = bench.ctx.notes.put(bench.agent, { text: 'one' })
    const second = bench.ctx.notes.put(bench.agent, { text: 'two' })
    try {
      bench.ctx.notes.put(bench.agent, { text: 'three' })
      expect.unreachable('creation past maxNotes must throw')
    } catch (error) {
      expect((error as HarnessError).code).toBe('notes-limit-reached')
    }
    expect(bench.ctx.notes.put(bench.agent, { id: first.id, text: 'one edited' }).text).toBe('one edited')
    expect(bench.state().notes.map(note => note.id)).toEqual([first.id, second.id])
  })

  it('clamps updatedAt forward when the wall clock moves backwards', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)
    const bench = await harness()
    const created = bench.ctx.notes.put(bench.agent, { text: 'a' })
    vi.setSystemTime(1_699_999_000_000)
    bench.ctx.notes.put(bench.agent, { text: 'b' })
    const replaced = bench.ctx.notes.put(bench.agent, { id: created.id, text: 'a2' })
    expect(replaced.updatedAt).toBe(1_700_000_000_000)
  })
})

describe('NoteService delete and setInject', () => {
  it('deletes an existing note and rejects an unknown one', async () => {
    const bench = await harness()
    const created = bench.ctx.notes.put(bench.agent, { text: 'gone soon' })
    bench.ctx.notes.delete(bench.agent, created.id)
    expect(bench.state().notes).toEqual([])
    try {
      bench.ctx.notes.delete(bench.agent, created.id)
      expect.unreachable('double delete must throw')
    } catch (error) {
      expect((error as HarnessError).code).toBe('notes-not-found')
    }
  })

  it('appends note/inject once per flip and no-ops on the recorded state', async () => {
    const bench = await harness()
    bench.ctx.notes.setInject(bench.agent, true)
    bench.ctx.notes.setInject(bench.agent, true)
    expect(bench.state().inject).toBe(true)
    expect(bench.session.events.filter(event => event.type === 'note/inject')).toHaveLength(1)
    bench.ctx.notes.setInject(bench.agent, false)
    expect(bench.state().inject).toBe(false)
  })
})

describe('NoteService importAsMessage', () => {
  it('rejects an empty selection', async () => {
    const bench = await harness()
    try {
      bench.ctx.notes.importAsMessage(bench.agent, {})
      expect.unreachable('empty import must throw')
    } catch (error) {
      expect((error as HarnessError).code).toBe('notes-nothing-to-import')
    }
  })

  it('steers one user message composing all notes pinned first', async () => {
    const bench = await harness()
    bench.ctx.notes.put(bench.agent, { text: 'later idea' })
    bench.ctx.notes.put(bench.agent, { text: 'urgent idea', pinned: true })
    const result = bench.ctx.notes.importAsMessage(bench.agent, {})
    expect(result).toEqual({ count: 2 })
    expect(bench.steered).toHaveLength(1)
    const block = bench.steered[0]!.content[0] as { type: string; text: string }
    expect(block.type).toBe('text')
    expect(block.text).toBe(
      'Here are my sticky notes to bring into this conversation:\n\n- [pinned] urgent idea\n- later idea',
    )
  })

  it('imports only the requested ids and rejects unknown ones', async () => {
    const bench = await harness()
    const first = bench.ctx.notes.put(bench.agent, { text: 'first' })
    bench.ctx.notes.put(bench.agent, { text: 'second' })
    const result = bench.ctx.notes.importAsMessage(bench.agent, { ids: [first.id] })
    expect(result).toEqual({ count: 1 })
    const block = bench.steered[0]!.content[0] as { type: string; text: string }
    expect(block.text).toContain('first')
    expect(block.text).not.toContain('second')
    try {
      bench.ctx.notes.importAsMessage(bench.agent, { ids: [NoteOf('note-missing')] })
      expect.unreachable('unknown id must throw')
    } catch (error) {
      expect((error as HarnessError).code).toBe('notes-not-found')
    }
  })

  it('rejects an agent that is not live in the registry', async () => {
    const bench = await harness()
    const ghost = stubAgent('notes-ghost')
    expect(() => bench.ctx.notes.put(ghost.agent, { text: 'ghost' })).toThrow(NoteError)
  })
})

/** Brand a raw id for negative-path requests. */
function NoteOf(id: string): NoteItem['id'] {
  return id as NoteItem['id']
}
