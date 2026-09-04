/**
 * NotesPanel: the sticky-notes dropdown panel hanging under its body-strip
 * trigger — a note-style task list with add, inline edit, pin, delete,
 * per-note color, the execute-tasks switch, and one-shot import as a user
 * message. Closed panels render null; the projection drives the list and the
 * panel store drives editor state.
 */

import { useMemo } from 'react'
import type { NoteItem } from '@deepseek-ai/dsh-notes/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { IconCloseOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { NoteCard } from './NoteCard.tsx'
import { NoteEditor } from './NoteEditor.tsx'
import type { NotesPanelActions } from './slots.ts'
import type { NotesStore } from './store.ts'
import css from './NotesPanel.module.css'

/** Full props of the dropdown panel: runtime seat + shared store + verbs + locale. */
export type NotesPanelProps = PropsRuntime<'conversation.session.body.utilities'> & PropsStore<NotesStore> & InjectFace<NotesPanelActions> & PropsLocale<'notes'>

/** Panel list order: oldest created first — the top-to-bottom task queue — id as the tiebreak. */
function panelOrder(notes: readonly NoteItem[]): readonly NoteItem[] {
  return [...notes].sort((left, right) =>
    left.createdAt !== right.createdAt
      ? left.createdAt - right.createdAt
      : left.id < right.id ? -1 : 1)
}

/** The dropdown panel under its trigger (closed panels render null). */
export function NotesPanel({ useProjection, useStore, actions, put, remove, setInject, importAll, t }: NotesPanelProps) {
  const state = useStore(s => s)
  const projection = useProjection('notes')
  const notes = projection?.notes ?? []
  const ordered = useMemo(() => panelOrder(notes), [notes])
  if (!state.open) return null
  const executeEnabled = projection?.inject ?? false
  const composing = state.editingId === 'new'

  /** Run one Remote verb promise, rendering its failure in the footer error line. */
  async function run(promise: Promise<RemoteResult<unknown>>): Promise<void> {
    const result = await promise
    if (!result.ok) actions.setError(`${result.error.message} (${result.error.code})`)
  }

  /** Commit the compose draft as a new note. */
  async function saveCompose(): Promise<void> {
    const text = state.draft.trim()
    if (text === '') return
    const result = await put({ text, color: state.draftColor })
    if (!result.ok) {
      actions.setError(`${result.error.message} (${result.error.code})`)
      return
    }
    actions.cancelEdit()
  }

  /** Commit the inline edit onto its note. */
  async function saveEdit(note: NoteItem): Promise<void> {
    const text = state.draft.trim()
    if (text === '') return
    const result = await put({ id: note.id, text, color: state.draftColor, pinned: note.pinned })
    if (!result.ok) {
      actions.setError(`${result.error.message} (${result.error.code})`)
      return
    }
    actions.cancelEdit()
  }

  return (
    <div className={css.panel} data-notes-panel>
      <div className={css.header}>
        <span className={css.title}>{t('panel.title')}</span>
        <label className={css.executeLabel}>
          <input
            type="checkbox"
            className={css.executeToggle}
            checked={executeEnabled}
            disabled={notes.length === 0}
            onChange={() => { void run(setInject(!executeEnabled)) }}
          />
          {t('panel.execute')}
        </label>
        <button
          type="button"
          className={css.importBtn}
          disabled={notes.length === 0}
          onClick={() => { void run(importAll()) }}
        >
          {t('panel.import')}
        </button>
        <button type="button" className={css.closeBtn} aria-label={t('panel.close')} onClick={() => { actions.setOpen(false) }}>
          <IconCloseOutline16 size={14} />
        </button>
      </div>

      <div className={css.viewport}>
        {ordered.map(note => (
          note.id === state.editingId
            ? (
              <NoteEditor
                key={note.id}
                value={state.draft}
                color={state.draftColor}
                onText={actions.setDraft}
                onColor={actions.setDraftColor}
                onSave={() => { void saveEdit(note) }}
                onCancel={actions.cancelEdit}
                t={t}
              />
            )
            : (
              <NoteCard
                key={note.id}
                note={note}
                editing={false}
                onTogglePin={(target) => {
                  void run(put({ id: target.id, text: target.text, color: target.color, pinned: !target.pinned }))
                }}
                onEdit={(target) => { actions.startEdit(target.id, target.text, target.color) }}
                onDelete={(id) => { void run(remove(id)) }}
                t={t}
              />
            )
        ))}
        {ordered.length === 0 && !composing && <div className={css.empty}>{t('panel.empty')}</div>}
        {composing && (
          <NoteEditor
            value={state.draft}
            color={state.draftColor}
            onText={actions.setDraft}
            onColor={actions.setDraftColor}
            onSave={() => { void saveCompose() }}
            onCancel={actions.cancelEdit}
            t={t}
          />
        )}
      </div>

      <div className={css.footer}>
        {state.error !== null && <span className={css.error} role="alert">{state.error}</span>}
        <span className={css.spacer} />
        {!composing && (
          <button type="button" className={css.addBtn} onClick={actions.startCompose}>{t('panel.add')}</button>
        )}
      </div>
    </div>
  )
}
