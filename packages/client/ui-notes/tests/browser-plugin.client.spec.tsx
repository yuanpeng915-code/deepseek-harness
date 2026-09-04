// @vitest-environment jsdom
/**
 * ui-notes browser half on a real cordis Context with fake slots/api/
 * sessions faces: the plugin registers the session body-utilities entry (the
 * trigger and its dropdown panel), the inject face's four verbs forward to
 * the notes Remote with the framework-resolved sessionId, a Remote failure
 * surfaces verbatim through the injected verbs, and registration disposal
 * rides the plugin fiber (HMR safety). The utility/panel/card/editor
 * components are exercised over faked store seats and Remote verbs. The node
 * half is exercised over the same Context.
 */
import { Context, Service } from '@deepseek-ai/cordis'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, act } from '@testing-library/react'
import { SlotRegistry, type SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { NoteColor, NoteId, NoteItem, NotePutRequest, NotesState } from '@deepseek-ai/dsh-notes/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { apply, inject } from '../src/client/index.ts'
import { apply as nodeApply } from '../src/index.ts'
import { createNotesStore, type NotesUiState } from '../src/client/store.ts'
import { zh } from '../src/client/locales.ts'
import { NotesButton } from '../src/client/NotesButton.tsx'
import { NotesUtility } from '../src/client/NotesUtility.tsx'
import { NotesPanel } from '../src/client/NotesPanel.tsx'
import { NoteEditor } from '../src/client/NoteEditor.tsx'

afterEach(cleanup)

const sid = (k: string): SessionId => k as SessionId

/** Build one canonical note fixture. */
function note(overrides: Partial<NoteItem> = {}): NoteItem {
  return {
    id: 'note-a' as NoteItem['id'],
    text: 'first note',
    color: 'yellow',
    pinned: false,
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  }
}

/** Boot the plugin over fake faces; the notes Remote records every call. */
async function bench(options: { failWith?: { code: string; message: string; details: object } } = {}) {
  const ctx = new Context()
  const calls: { method: string; args: unknown[] }[] = []
  const answer = <T,>(method: string, value: T) =>
    (...args: unknown[]): Promise<RemoteResult<T>> => {
      calls.push({ method, args })
      if (options.failWith !== undefined) return Promise.resolve({ ok: false, error: options.failWith })
      return Promise.resolve({ ok: true, value })
    }
  class RemoteService extends Service {
    constructor(serviceCtx: Context) {
      super(serviceCtx, 'remote')
    }
  }
  new RemoteService(ctx)
  ctx.provide('remote.notes', {
    put: answer('notes/put', note()),
    delete: answer('notes/delete', undefined),
    setInject: answer('notes/setInject', undefined),
    import: answer('notes/import', { count: 2 }),
  })
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root', children: {
      'conversation.session.body.utilities': { kind: 'list', scope: 'session' },
    },
  } as never, (() => null) as never)
  ctx.provide('locale', new LocaleRuntime(ctx))
  ctx.provide('sessions', {
    binding: (id: SessionId) => ({
      sessionId: id,
      session: { projections: { faceOf: () => ({
        getSnapshot: () => undefined,
        subscribe: () => () => {},
      }) } },
      ctx,
    }),
  })
  const fiber = ctx.plugin({ inject: [...inject], apply })
  return {
    ctx,
    fiber,
    calls,
    entry: (name: 'conversation.session.body.utilities') => {
      const entry = ctx.slots.entries(name)[0]
      if (entry === undefined) return undefined
      return {
        ...entry.options,
        locale: entry.locale,
        inject: entry.inject as unknown as ((sessionId: SessionId) => unknown) | undefined,
      }
    },
  }
}

describe('ui-notes browser plugin', () => {
  it('registers the body-utilities entry with the trigger, panel store, and verbs', async () => {
    const b = await bench()
    await b.fiber.await()
    expect(b.entry('conversation.session.body.utilities')).toMatchObject({ id: 'notes', locale: 'notes' })
    expect(b.entry('conversation.session.body.utilities')?.inject).toBeTypeOf('function')
  })

  it('the panel verbs forward to the notes Remote with the resolved session id', async () => {
    const b = await bench()
    await b.fiber.await()
    const verbs = b.entry('conversation.session.body.utilities')!.inject!(sid('s1')) as {
      put: (r: object) => Promise<unknown>
      remove: (id: string) => Promise<unknown>
      setInject: (enabled: boolean) => Promise<unknown>
      importAll: () => Promise<unknown>
    }
    const id = 'note-a' as NoteItem['id']
    expect(await verbs.put({ text: 'idea' })).toEqual({ ok: true, value: note() })
    expect(await verbs.remove(id)).toEqual({ ok: true, value: undefined })
    expect(await verbs.setInject(true)).toEqual({ ok: true, value: undefined })
    expect(await verbs.importAll()).toEqual({ ok: true, value: { count: 2 } })
    expect(b.calls.map(c => c.method)).toEqual(['notes/put', 'notes/delete', 'notes/setInject', 'notes/import'])
    expect(b.calls[0]?.args).toEqual(['s1', { text: 'idea' }])
    expect(b.calls[1]?.args).toEqual(['s1', id])
    expect(b.calls[2]?.args).toEqual(['s1', true])
    expect(b.calls[3]?.args).toEqual(['s1', {}])
  })

  it('forwards a Remote failure through the verbs verbatim', async () => {
    const b = await bench({ failWith: { code: 'notes-limit-reached', message: 'already holds 100 notes', details: {} } })
    await b.fiber.await()
    const verbs = b.entry('conversation.session.body.utilities')!.inject!(sid('s1')) as {
      put: (r: object) => Promise<unknown>
    }
    expect(await verbs.put({ text: 'idea' })).toEqual({
      ok: false,
      error: { code: 'notes-limit-reached', message: 'already holds 100 notes', details: {} },
    })
  })

  it('drops the entry when the plugin fiber unloads (HMR safety)', async () => {
    const b = await bench()
    await b.fiber.await()
    expect(b.entry('conversation.session.body.utilities')).toBeDefined()
    await b.fiber.dispose()
    expect(b.entry('conversation.session.body.utilities')).toBeUndefined()
  })
})

describe('ui-notes node half', () => {
  // The invariant companion is mounted by the vitest-wide invariant host on
  // every Context this suite creates; its registration is covered there.
  it('the node apply is an inert loader seat', () => {
    expect(() => { nodeApply() }).not.toThrow()
  })
})

/** Faked store seat: a plain state object, recording actions, and a live selector hook. */
function fakeStore(overrides: Partial<{ open: boolean; editingId: string | null; draft: string; error: string | null }> = {}) {
  const state: NotesUiState = { open: true, editingId: null, draft: '', draftColor: 'yellow', error: null, ...overrides }
  const calls: string[] = []
  const actions = {
    setOpen: (open: boolean) => { calls.push(`setOpen:${String(open)}`); state.open = open },
    startCompose: () => { calls.push('startCompose'); state.editingId = 'new'; state.draft = ''; state.error = null },
    startEdit: (id: string, text: string, color: NoteColor) => {
      calls.push(`startEdit:${id}`)
      state.editingId = id
      state.draft = text
      state.draftColor = color
      state.error = null
    },
    cancelEdit: () => { calls.push('cancelEdit'); state.editingId = null; state.draft = '' },
    setDraft: (text: string) => { state.draft = text },
    setDraftColor: (color: NoteColor) => { state.draftColor = color },
    setError: (error: string | null) => { calls.push(`setError:${error ?? 'null'}`); state.error = error },
  }
  const useStore = <U,>(selector: (s: NotesUiState) => U): U => selector(state)
  return { state, actions, useStore, calls }
}

/** Faked Remote verbs recording calls, optionally failing. */
function fakeVerbs(failWith?: { code: string; message: string }) {
  const calls: { verb: string; args: unknown }[] = []
  const ok = <T,>(value: T): RemoteResult<T> => ({ ok: true, value })
  const fail = (): RemoteResult<never> => ({
    ok: false,
    error: { code: failWith?.code ?? '', message: failWith?.message ?? '', details: {} },
  })
  const verbs = {
    put: (request: NotePutRequest) => {
      calls.push({ verb: 'put', args: request })
      return Promise.resolve(failWith === undefined ? ok(note()) : fail())
    },
    remove: (id: NoteId) => {
      calls.push({ verb: 'remove', args: id })
      return Promise.resolve(failWith === undefined ? ok(undefined) : fail())
    },
    setInject: (enabled: boolean) => {
      calls.push({ verb: 'setInject', args: enabled })
      return Promise.resolve(failWith === undefined ? ok(undefined) : fail())
    },
    importAll: () => {
      calls.push({ verb: 'importAll', args: undefined })
      return Promise.resolve(failWith === undefined ? ok({ count: 1 }) : fail())
    },
  }
  return { calls, verbs }
}

const t = makeTranslate(zh, commonZh)

/** Render the trigger with test doubles; the mixed prop-bag cast lives here. */
function renderButton(props: Record<string, unknown>) {
  return render(<NotesButton {...(props as unknown as Parameters<typeof NotesButton>[0])} />)
}

/** Render the panel with test doubles; the mixed prop-bag cast lives here. */
function renderPanel(props: Record<string, unknown>) {
  return render(<NotesPanel {...(props as unknown as Parameters<typeof NotesPanel>[0])} />)
}

describe('NotesButton', () => {
  it('renders the trigger and toggles the shared panel store', () => {
    const store = fakeStore({ open: false })
    const shown = renderButton({ useStore: store.useStore, actions: store.actions, t })
    expect(shown.getByRole('button', { name: '便签' })).toBeTruthy()
    fireEvent.click(shown.getByRole('button'))
    expect(store.calls).toEqual(['setOpen:true'])
  })
})

describe('NotesUtility', () => {
  it('mounts the trigger and, while open, the panel under one anchor', () => {
    const store = fakeStore()
    const props = { ...fakeVerbs().verbs, actions: store.actions, useStore: store.useStore, useProjection: () => null, t }
    const shown = render(<NotesUtility {...(props as unknown as Parameters<typeof NotesUtility>[0])} />)
    expect(shown.getByRole('button', { name: '便签' })).toBeTruthy()
    expect(shown.getByText('暂无便签')).toBeTruthy()
  })
})

describe('NotesPanel', () => {
  it('renders nothing while closed', () => {
    const store = fakeStore({ open: false })
    const shown = renderPanel({ ...fakeVerbs().verbs, actions: store.actions, useStore: store.useStore, useProjection: () => null, t })
    expect(shown.container.firstChild).toBeNull()
  })

  it('survives repeated open/close toggles on one mount', () => {
    const store = fakeStore({ open: false })
    const props = { ...fakeVerbs().verbs, actions: store.actions, useStore: store.useStore, useProjection: () => null, t }
    const element = () => <NotesPanel {...(props as unknown as Parameters<typeof NotesPanel>[0])} />
    const shown = render(element())
    expect(shown.container.firstChild).toBeNull()
    act(() => { store.actions.setOpen(true) })
    shown.rerender(element())
    expect(shown.getByText('暂无便签')).toBeTruthy()
    act(() => { store.actions.setOpen(false) })
    shown.rerender(element())
    expect(shown.container.firstChild).toBeNull()
    act(() => { store.actions.setOpen(true) })
    shown.rerender(element())
    expect(shown.getByText('暂无便签')).toBeTruthy()
  })

  it('orders pinned first, then most recently edited, and renders the empty state', () => {
    const notes: NotesState = {
      notes: [
        note({ id: 'note-b' as NoteItem['id'], text: 'edited later', createdAt: 200, updatedAt: 300 }),
        note({ id: 'note-a' as NoteItem['id'], text: 'pinned idea', pinned: true, createdAt: 100, updatedAt: 150 }),
        note({ id: 'note-c' as NoteItem['id'], text: 'plain', createdAt: 200, updatedAt: 200 }),
      ],
      inject: false,
    }
    const store = fakeStore()
    const shown = renderPanel({ ...fakeVerbs().verbs, actions: store.actions, useStore: store.useStore, useProjection: () => notes, t })
    const cards = shown.container.querySelectorAll('[data-note-card]')
    expect([...cards].map(card => card.textContent)).toEqual(['pinned idea', 'edited later', 'plain'])
    cleanup()

    const empty = fakeStore()
    const emptyShown = renderPanel({ ...fakeVerbs().verbs, actions: empty.actions, useStore: empty.useStore, useProjection: () => null, t })
    expect(emptyShown.getByText('暂无便签')).toBeTruthy()
  })

  it('wires the inject toggle, import, add, and close controls to the verbs and store', () => {
    const notes: NotesState = { notes: [note()], inject: true }
    const store = fakeStore()
    const { verbs, calls } = fakeVerbs()
    const shown = renderPanel({ ...verbs, actions: store.actions, useStore: store.useStore, useProjection: () => notes, t })
    const checkbox = shown.getByRole('checkbox') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    fireEvent.click(checkbox)
    fireEvent.click(shown.getByRole('button', { name: '导入对话' }))
    fireEvent.click(shown.getByRole('button', { name: '添加便签' }))
    fireEvent.click(shown.getByRole('button', { name: '关闭' }))
    expect(calls).toEqual([
      { verb: 'setInject', args: false },
      { verb: 'importAll', args: undefined },
    ])
    expect(store.calls).toEqual(['startCompose', 'setOpen:false'])
  })

  it('disables import while no notes exist and surfaces a stored error', () => {
    const store = fakeStore({ error: 'already holds 100 notes (notes-limit-reached)' })
    const { verbs, calls } = fakeVerbs()
    const shown = renderPanel({ ...verbs, actions: store.actions, useStore: store.useStore, useProjection: () => null, t })
    expect((shown.getByRole('button', { name: '导入对话' }) as HTMLButtonElement).disabled).toBe(true)
    expect(shown.getByRole('alert').textContent).toBe('already holds 100 notes (notes-limit-reached)')
    expect(calls).toEqual([])
  })

  it('composes a note through the editor and forwards the trimmed draft with its color', async () => {
    const store = fakeStore({ editingId: 'new', draft: '  draft idea  ' })
    store.state.draftColor = 'green'
    const { verbs, calls } = fakeVerbs()
    const shown = renderPanel({ ...verbs, actions: store.actions, useStore: store.useStore, useProjection: () => null, t })
    fireEvent.click(shown.getByRole('button', { name: '保存' }))
    await vi.waitFor(() => { expect(calls).toEqual([{ verb: 'put', args: { text: 'draft idea', color: 'green' } }]) })
    expect(store.calls).toEqual(['cancelEdit'])
  })

  it('saves an inline edit back onto its note and keeps the pin', async () => {
    const notes: NotesState = { notes: [note({ text: 'original', pinned: true })], inject: false }
    const store = fakeStore({ editingId: 'note-a', draft: '  rewritten  ' })
    store.state.draftColor = 'blue'
    const { verbs, calls } = fakeVerbs()
    const shown = renderPanel({ ...verbs, actions: store.actions, useStore: store.useStore, useProjection: () => notes, t })
    fireEvent.click(shown.getByRole('button', { name: '保存' }))
    await vi.waitFor(() => { expect(calls).toEqual([{
      verb: 'put',
      args: { id: 'note-a', text: 'rewritten', color: 'blue', pinned: true },
    }]) })
  })

  it('surfaces a failing save through the store error and keeps the editor open', async () => {
    const store = fakeStore({ editingId: 'new', draft: 'idea' })
    const { verbs, calls } = fakeVerbs({ code: 'notes-limit-reached', message: 'limit' })
    const shown = renderPanel({ ...verbs, actions: store.actions, useStore: store.useStore, useProjection: () => null, t })
    fireEvent.click(shown.getByRole('button', { name: '保存' }))
    await vi.waitFor(() => { expect(calls).toEqual([{ verb: 'put', args: { text: 'idea', color: 'yellow' } }]) })
    expect(store.calls).toEqual(['setError:limit (notes-limit-reached)'])
  })

  it('toggles pin and deletes from the card actions', () => {
    const notes: NotesState = { notes: [note({ pinned: true })], inject: false }
    const store = fakeStore()
    const { verbs, calls } = fakeVerbs()
    const shown = renderPanel({ ...verbs, actions: store.actions, useStore: store.useStore, useProjection: () => notes, t })
    fireEvent.click(shown.getByRole('button', { name: '取消置顶' }))
    fireEvent.click(shown.getByRole('button', { name: '删除' }))
    expect(calls).toEqual([
      { verb: 'put', args: { id: 'note-a', text: 'first note', color: 'yellow', pinned: false } },
      { verb: 'remove', args: 'note-a' },
    ])
    expect(store.calls).toEqual([])
  })

  it('opens the inline editor from a card', () => {
    const notes: NotesState = { notes: [note()], inject: false }
    const store = fakeStore()
    const shown = renderPanel({ ...fakeVerbs().verbs, actions: store.actions, useStore: store.useStore, useProjection: () => notes, t })
    fireEvent.click(shown.getByRole('button', { name: '编辑' }))
    expect(store.calls).toEqual(['startEdit:note-a'])
  })
})

describe('NoteEditor', () => {
  it('renders the palette, selects colors, and saves on Enter', () => {
    const calls: string[] = []
    const shown = render(
      <NoteEditor
        value="draft"
        color="yellow"
        onText={(text) => { calls.push(`text:${text}`) }}
        onColor={(color) => { calls.push(`color:${color}`) }}
        onSave={() => { calls.push('save') }}
        onCancel={() => { calls.push('cancel') }}
        t={t}
      />,
    )
    expect(shown.getByRole('radiogroup')).toBeTruthy()
    fireEvent.click(shown.getByRole('radio', { name: '蓝色' }))
    fireEvent.keyDown(shown.getByRole('textbox', { name: '便签内容' }), { key: 'Enter' })
    expect(calls).toEqual(['color:blue', 'save'])
  })

  it('cancels on Escape, disables an empty save, and honors busy', () => {
    const calls: string[] = []
    const shown = render(
      <NoteEditor
        value="draft"
        color="yellow"
        onText={() => {}}
        onColor={() => {}}
        onSave={() => { calls.push('save') }}
        onCancel={() => { calls.push('cancel') }}
        busy
        t={t}
      />,
    )
    fireEvent.keyDown(shown.getByRole('textbox'), { key: 'Escape' })
    expect((shown.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true)
    expect(calls).toEqual(['cancel'])
    cleanup()

    const blank = render(
      <NoteEditor
        value="   "
        color="yellow"
        onText={() => {}}
        onColor={() => {}}
        onSave={() => { calls.push('save') }}
        onCancel={() => {}}
        t={t}
      />,
    )
    expect((blank.getByRole('button', { name: '保存' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('createNotesStore', () => {
  it('runs every action against one engine instance', () => {
    const instance = createNotesStore().create('spec')
    instance.actions.startCompose()
    expect(instance.getSnapshot()).toMatchObject({ editingId: 'new', draft: '', draftColor: 'yellow' })
    instance.actions.setDraft(' hi ')
    instance.actions.setDraftColor('purple')
    expect(instance.getSnapshot()).toMatchObject({ draft: ' hi ', draftColor: 'purple' })
    instance.actions.startEdit('note-1', 'text', 'gray')
    expect(instance.getSnapshot()).toMatchObject({ editingId: 'note-1', draft: 'text', draftColor: 'gray' })
    instance.actions.setError('boom')
    expect(instance.getSnapshot()).toMatchObject({ error: 'boom' })
    instance.actions.cancelEdit()
    expect(instance.getSnapshot()).toMatchObject({ editingId: null, draft: '', error: null })
    instance.actions.setOpen(true)
    expect(instance.getSnapshot()).toMatchObject({ open: true })
  })
})
