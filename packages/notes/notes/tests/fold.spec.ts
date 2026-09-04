/** Pure fold, decoder, and renderer coverage for the notes domain. */

import { describe, expect, it } from 'vitest'
import {
  applyNoteEvent,
  composeImportText,
  decodeNoteDelete,
  decodeNoteInject,
  decodeNoteItem,
  emptyNotesState,
  foldNotes,
  orderNotesForDisplay,
  renderNotesSection,
} from '../src/fold.ts'
import { NoteId } from '../src/runtime.ts'
import type { NoteItem, NotesState } from '../src/types.ts'

/** Build one canonical note fixture. */
function note(overrides: Partial<NoteItem> = {}): NoteItem {
  return {
    id: NoteId('note-a'),
    text: 'first note',
    color: 'yellow',
    pinned: false,
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  }
}

/** One folded state after applying the given note events. */
function folded(...events: { type: string; data: unknown }[]): NotesState {
  return foldNotes(events)
}

describe('decodeNoteItem', () => {
  it('accepts a canonical item and brands the id', () => {
    expect(decodeNoteItem(note())).toEqual(note())
  })

  it('rejects shape, text, color, and timestamp violations', () => {
    expect(() => decodeNoteItem({ ...note(), extra: true })).toThrow('exactly')
    expect(() => decodeNoteItem({ ...note(), text: '  ' })).toThrow('non-empty and trimmed')
    expect(() => decodeNoteItem({ ...note(), text: ' padded ' })).toThrow('non-empty and trimmed')
    expect(() => decodeNoteItem({ ...note(), color: 'orange' })).toThrow('color must be one of')
    expect(() => decodeNoteItem({ ...note(), updatedAt: 99 })).toThrow('cannot precede createdAt')
    expect(() => decodeNoteItem({ ...note(), id: '' })).toThrow('non-empty string')
  })
})

describe('decodeNoteDelete and decodeNoteInject', () => {
  it('accepts canonical payloads and rejects the rest', () => {
    expect(decodeNoteDelete({ id: 'note-a' })).toBe('note-a')
    expect(() => decodeNoteDelete({ id: 'note-a', extra: 1 })).toThrow('exactly an id field')
    expect(() => decodeNoteDelete({ id: '' })).toThrow('non-empty string')
    expect(decodeNoteInject({ enabled: true })).toBe(true)
    expect(() => decodeNoteInject({ enabled: 'yes' })).toThrow('boolean')
    expect(() => decodeNoteInject({})).toThrow('exactly an enabled field')
  })
})

describe('applyNoteEvent', () => {
  it('appends unknown ids and replaces known ids in place', () => {
    const second = note({ id: NoteId('note-b'), createdAt: 200, updatedAt: 200 })
    const afterAppend = applyNoteEvent(emptyNotesState(), { type: 'note/put', data: { note: note() } })
    expect(afterAppend.notes).toEqual([note()])
    const replaced = applyNoteEvent(afterAppend, { type: 'note/put', data: { note: { ...note(), text: 'rewritten', updatedAt: 300 } } })
    expect(replaced.notes).toEqual([{ ...note(), text: 'rewritten', updatedAt: 300 }])
    const appended = applyNoteEvent(replaced, { type: 'note/put', data: { note: second } })
    expect(appended.notes).toEqual([{ ...note(), text: 'rewritten', updatedAt: 300 }, second])
  })

  it('deletes by id and ignores unknown ids', () => {
    const state = folded({ type: 'note/put', data: { note: note() } })
    expect(applyNoteEvent(state, { type: 'note/delete', data: { id: 'note-a' } }).notes).toEqual([])
    expect(applyNoteEvent(state, { type: 'note/delete', data: { id: 'note-missing' } })).toBe(state)
  })

  it('flips the injection switch and collapses no-op flips', () => {
    const state = folded({ type: 'note/put', data: { note: note() } })
    const on = applyNoteEvent(state, { type: 'note/inject', data: { enabled: true } })
    expect(on.inject).toBe(true)
    expect(applyNoteEvent(on, { type: 'note/inject', data: { enabled: true } })).toBe(on)
    expect(applyNoteEvent(on, { type: 'note/inject', data: { enabled: false } }).inject).toBe(false)
  })

  it('returns the same reference for malformed note payloads and unrelated events', () => {
    const state = folded({ type: 'note/put', data: { note: note() } })
    expect(applyNoteEvent(state, { type: 'note/put', data: { note: { ...note(), color: 'orange' } } })).toBe(state)
    expect(applyNoteEvent(state, { type: 'note/delete', data: {} })).toBe(state)
    expect(applyNoteEvent(state, { type: 'note/inject', data: { enabled: 1 } })).toBe(state)
    expect(applyNoteEvent(state, { type: 'turn/start', data: { turn: 1 } })).toBe(state)
  })
})

describe('foldNotes', () => {
  it('folds a whole log and honors a prefix end', () => {
    const events = [
      { type: 'note/put', data: { note: note() } },
      { type: 'note/inject', data: { enabled: true } },
      { type: 'note/put', data: { note: note({ id: NoteId('note-b'), text: 'second', createdAt: 200, updatedAt: 200 }) } },
    ]
    expect(foldNotes(events)).toEqual({
      notes: [note(), note({ id: NoteId('note-b'), text: 'second', createdAt: 200, updatedAt: 200 })],
      inject: true,
    })
    expect(foldNotes(events, 1)).toEqual({ notes: [note()], inject: false })
    expect(foldNotes([], 0)).toEqual(emptyNotesState())
  })
})

describe('orderNotesForDisplay', () => {
  it('orders oldest created first with the id as the tiebreak, ignoring pins', () => {
    const a = note({ id: NoteId('note-a'), createdAt: 300 })
    const b = note({ id: NoteId('note-b'), createdAt: 100 })
    const c = note({ id: NoteId('note-c'), createdAt: 100, pinned: true })
    expect(orderNotesForDisplay([a, b, c]).map(entry => entry.id)).toEqual(['note-b', 'note-c', 'note-a'])
  })
})

describe('renderNotesSection', () => {
  it('renders nothing while execution is off or no notes exist', () => {
    expect(renderNotesSection({ notes: [note()], inject: false })).toBe('')
    expect(renderNotesSection({ notes: [], inject: true })).toBe('')
  })

  it('renders oldest-first bullets with pin markers while execution is on', () => {
    const state: NotesState = {
      notes: [
        note({ id: NoteId('note-b'), text: 'plain idea', createdAt: 200 }),
        note({ id: NoteId('note-a'), text: 'urgent idea', pinned: true, createdAt: 300 }),
      ],
      inject: true,
    }
    expect(renderNotesSection(state)).toBe(
      'The user\'s sticky notes for this conversation (oldest first):\n\n- plain idea\n- [pinned] urgent idea',
    )
  })
})

describe('composeImportText', () => {
  it('composes the one-shot import body with the same oldest-first bullets', () => {
    expect(composeImportText([note()])).toBe(
      'Here are my sticky notes to bring into this conversation:\n\n- first note',
    )
  })
})
