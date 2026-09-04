/**
 * NoteCard: one sticky note in the panel — colored paper card (noty palette,
 * flat tinted ground + 4px left strip), a pinned marker, and hover actions
 * (pin toggle, edit, delete). Pure props: state lives in the projection and
 * the panel store.
 */

import type { NoteItem } from '@deepseek-ai/dsh-notes/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import css from './NoteCard.module.css'

/** Card callbacks: the panel closes over the Remote verbs. */
export type NoteCardProps = {
  /** The rendered note (projection value). */
  note: NoteItem
  /** Toggle the pinned flag. */
  onTogglePin: (note: NoteItem) => void
  /** Open the inline editor for this note. */
  onEdit: (note: NoteItem) => void
  /** Delete this note. */
  onDelete: (id: NoteItem['id']) => void
  /** Whether the inline editor is currently open on this card. */
  editing: boolean
} & PropsLocale<'notes'>

/** One colored sticky-note card. */
export function NoteCard({ note, onTogglePin, onEdit, onDelete, editing, t }: NoteCardProps) {
  return (
    <div className={css.card} data-color={note.color} data-note-card>
      <div className={css.top}>
        {note.pinned && <span className={css.pinMark} aria-hidden="true" />}
        <span className={css.spacer} />
        <div className={css.actions}>
          <button
            type="button"
            className={css.iconBtn}
            aria-label={note.pinned ? t('card.unpin') : t('card.pin')}
            title={note.pinned ? t('card.unpin') : t('card.pin')}
            onClick={() => { onTogglePin(note) }}
          >
            <PinGlyph filled={note.pinned} />
          </button>
          <button
            type="button"
            className={css.iconBtn}
            aria-label={t('card.edit')}
            title={t('card.edit')}
            onClick={() => { onEdit(note) }}
          >
            <EditGlyph />
          </button>
          <button
            type="button"
            className={css.iconBtn}
            aria-label={t('card.delete')}
            title={t('card.delete')}
            onClick={() => { onDelete(note.id) }}
          >
            <DeleteGlyph />
          </button>
        </div>
      </div>
      {editing
        ? null
        : <div className={css.text}>{note.text}</div>}
    </div>
  )
}

/** Pin glyph: outline when unpinned, filled when pinned. */
function PinGlyph({ filled }: { filled: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 2 12 6 10 7.5 10 11 6 11 6 7.5 4 6zM8 11 8 14.5"
        stroke="currentColor"
        strokeWidth={1.2}
        fill={filled ? 'currentColor' : 'none'}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Edit glyph (pencil). */
function EditGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 13 3.5 10.5 10.5 3.5 12.5 5.5 5.5 12.5zM9.5 4.5 11.5 6.5" stroke="currentColor" strokeWidth={1.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/** Delete glyph (trash). */
function DeleteGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 5h10M6 5V3h4v2M4.5 5 5 13.5h6L11.5 5" stroke="currentColor" strokeWidth={1.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
