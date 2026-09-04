/**
 * Injected face of the notes panel. The target slots
 * (`conversation.input.left`, `conversation.input.overlay`) are declared and
 * typed by ui-conversation / ui-input-trigger; this package only contributes
 * the entries. The live notes value is NOT part of this face — it arrives
 * through `useProjection('notes')`; inject carries only the mutation verbs
 * through the generated notes Remote API.
 */

import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { NoteId, NoteImportResult, NoteItem, NotePutRequest } from '@deepseek-ai/dsh-notes/client'

/** Injected business face of the notes panel: the four Remote verbs. */
export interface NotesPanelActions {
  /** Create or replace one note. */
  put: (request: NotePutRequest) => Promise<RemoteResult<NoteItem>>
  /** Delete one note by id. */
  remove: (id: NoteId) => Promise<RemoteResult<void>>
  /** Flip the context-injection switch. */
  setInject: (enabled: boolean) => Promise<RemoteResult<void>>
  /** Send the notes as one user message into the conversation. */
  importAll: () => Promise<RemoteResult<NoteImportResult>>
}
