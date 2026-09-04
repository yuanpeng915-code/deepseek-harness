/**
 * NotesUtility: the session body-utilities entry. One anchor wraps the
 * trigger and the dropdown panel, so the panel positions relative to its own
 * button regardless of the other strip entries.
 */

import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { NotesButton } from './NotesButton.tsx'
import { NotesPanel } from './NotesPanel.tsx'
import type { NotesPanelActions } from './slots.ts'
import type { NotesStore } from './store.ts'
import css from './NotesUtility.module.css'

/** Full props of the body-utilities entry: runtime seat + shared store + verbs + locale. */
export type NotesUtilityProps = PropsRuntime<'conversation.session.body.utilities'> & PropsStore<NotesStore> & InjectFace<NotesPanelActions> & PropsLocale<'notes'>

/** The trigger and its dropdown panel under one positioning anchor. */
export function NotesUtility(props: NotesUtilityProps) {
  return (
    <div className={css.anchor}>
      <NotesButton {...props} />
      <NotesPanel {...props} />
    </div>
  )
}
