/**
 * NoteEditor: the textarea + color palette row shared by "add note" and the
 * inline card edit. Pure props — the panel owns the draft (panel store) and
 * the save verb.
 */

import { useEffect, useRef } from 'react'
import type { NoteColor } from '@deepseek-ai/dsh-notes/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { NotesKey } from './locales.ts'
import css from './NoteEditor.module.css'

/** All palette colors in display order (matches the noty six-color tray). */
const PALETTE: readonly NoteColor[] = ['yellow', 'green', 'blue', 'pink', 'purple', 'gray']

/** Palette color → dictionary key. */
const COLOR_KEYS = {
  yellow: 'color.yellow',
  green: 'color.green',
  blue: 'color.blue',
  pink: 'color.pink',
  purple: 'color.purple',
  gray: 'color.gray',
} as const satisfies Record<NoteColor, NotesKey>

/** Editor callbacks and draft bindings. */
export type NoteEditorProps = {
  /** Current draft text. */
  value: string
  /** Current draft color. */
  color: NoteColor
  /** Draft text change. */
  onText: (text: string) => void
  /** Draft color change. */
  onColor: (color: NoteColor) => void
  /** Commit the draft (Enter or the save button). */
  onSave: () => void
  /** Discard the editor. */
  onCancel: () => void
  /** Disable the save control (in-flight Remote call). */
  busy?: boolean
} & PropsLocale<'notes'>

/** Textarea + palette row for composing and editing one note. */
export function NoteEditor({ value, color, onText, onColor, onSave, onCancel, busy, t }: NoteEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Focus the textarea once per editor mount; later value updates (typing)
  // must not steal the caret back.
  useEffect(() => {
    ref.current?.focus()
  }, [])

  return (
    <div className={css.editor}>
      <textarea
        ref={ref}
        className={css.input}
        rows={3}
        aria-label={t('editor.aria')}
        placeholder={t('editor.placeholder')}
        value={value}
        onChange={(e) => { onText(e.target.value) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSave()
          }
          if (e.key === 'Escape') onCancel()
        }}
      />
      <div className={css.row}>
        <div className={css.palette} role="radiogroup" aria-label={t('panel.title')}>
          {PALETTE.map(entry => (
            <button
              key={entry}
              type="button"
              role="radio"
              aria-checked={entry === color}
              className={css.swatch}
              data-color={entry}
              data-selected={entry === color || undefined}
              title={t(COLOR_KEYS[entry])}
              onClick={() => { onColor(entry) }}
            />
          ))}
        </div>
        <div className={css.actions}>
          <button type="button" className={css.cancelBtn} onClick={onCancel}>{t('editor.cancel')}</button>
          <button type="button" className={css.saveBtn} onClick={onSave} disabled={busy || value.trim() === ''}>
            {t('editor.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
