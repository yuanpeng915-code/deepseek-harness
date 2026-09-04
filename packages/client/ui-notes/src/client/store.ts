/**
 * Panel-local interaction store shared by the composer-left trigger and the
 * overlay panel. UI state only — the notes themselves arrive on the notes
 * projection, so nothing here persists.
 */

import { defineStore } from '@deepseek-ai/dsh-client-runtime/client'
import type { EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import type { NoteColor } from '@deepseek-ai/dsh-notes/client'

/** UI-only panel state. */
export interface NotesUiState {
  /** Panel visibility (one value per session, shared with the trigger). */
  open: boolean
  /** Note id being edited inline, or `'new'` while composing, or null. */
  editingId: string | null
  /** Draft text of the editor (create and inline edit share one editor). */
  draft: string
  /** Draft color of the editor. */
  draftColor: NoteColor
  /** Last failed Remote verb, rendered as one error line. */
  error: string | null
}

/** Action signatures of the panel store; the first parameter is the mutable draft. */
export type NotesUiActions = {
  /** Show or hide the overlay panel. */
  setOpen: (draft: NotesUiState, open: boolean) => void
  /** Enter compose mode with a blank yellow draft. */
  startCompose: (draft: NotesUiState) => void
  /** Enter inline-edit mode seeded from one note. */
  startEdit: (draft: NotesUiState, id: string, text: string, color: NoteColor) => void
  /** Leave the editor and clear the draft. */
  cancelEdit: (draft: NotesUiState) => void
  /** Replace the draft text. */
  setDraft: (draft: NotesUiState, text: string) => void
  /** Replace the draft color. */
  setDraftColor: (draft: NotesUiState, color: NoteColor) => void
  /** Record or clear the last failed Remote verb. */
  setError: (draft: NotesUiState, error: string | null) => void
}

/**
 * Shared panel store handle (session scope resolves per session).
 * @returns the store factory consumed by both slot registrations.
 */
export function createNotesStore(): EngineStoreHandle<NotesUiState, NotesUiActions> {
  return defineStore({
    init: (): NotesUiState => ({ open: false, editingId: null, draft: '', draftColor: 'yellow', error: null }),
    actions: {
      setOpen: (d, open: boolean) => { d.open = open },
      startCompose: (d) => { d.editingId = 'new'; d.draft = ''; d.draftColor = 'yellow'; d.error = null },
      startEdit: (d, id: string, text: string, color: NoteColor) => {
        d.editingId = id
        d.draft = text
        d.draftColor = color
        d.error = null
      },
      cancelEdit: (d) => { d.editingId = null; d.draft = ''; d.error = null },
      setDraft: (d, text: string) => { d.draft = text },
      setDraftColor: (d, color: NoteColor) => { d.draftColor = color },
      setError: (d, error: string | null) => { d.error = error },
    },
  })
}

/** Store handle type shared by the trigger and panel registrations. */
export type NotesStore = ReturnType<typeof createNotesStore>
