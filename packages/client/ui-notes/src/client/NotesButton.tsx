/**
 * NotesButton: the sticky-notes trigger in the session body's utility strip.
 * A session-scoped toggle over the shared panel store; the button renders
 * regardless of panel state and the panel itself renders null while closed.
 */

import { IconListPenOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { NotesStore } from './store.ts'
import css from './NotesButton.module.css'

/** Full props of the trigger: runtime seat + the shared store + locale. */
export type NotesButtonProps = PropsRuntime<'conversation.session.body.utilities'> & PropsStore<NotesStore> & PropsLocale<'notes'>

/** Body-utilities trigger toggling the notes dropdown panel. */
export function NotesButton({ useStore, actions, t }: NotesButtonProps) {
  const open = useStore(s => s.open)
  return (
    <button
      type="button"
      className={css.trigger}
      data-open={open || undefined}
      aria-label={t('trigger.aria')}
      title={t('trigger.aria')}
      onClick={() => { actions.setOpen(!open) }}
    >
      <IconListPenOutline16 size={16} />
    </button>
  )
}
