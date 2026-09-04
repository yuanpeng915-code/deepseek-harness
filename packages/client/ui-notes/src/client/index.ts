/**
 * Sticky-notes surface plugin, browser half: one entry in the session body's
 * utility strip — the trigger and its dropdown panel over the notes session
 * projection. Projection-mode surface — the notes arrive through
 * `useProjection('notes')` — so this plugin owns no durable state; its
 * session-scoped store holds only interaction state (panel open, editor
 * draft, last error). The Remote face carries the four notes verbs
 * (put/delete/setInject/import).
 */
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the generated Remote API and ctx.remote merge through the Client assembly boundary.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
// Type-only: pulls the ui-conversation SlotMap merge (conversation.session.body.utilities).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the `notes` SessionProjectionMap key merge (single source, the domain's pure outlet).
import type {} from '@deepseek-ai/dsh-notes/client'
import { NotesUtility } from './NotesUtility.tsx'
import { createNotesStore } from './store.ts'
import { en, zh } from './locales.ts'
import type { NotesPanelActions } from './slots.ts'

export { createNotesStore } from './store.ts'
export type { NotesKey } from './locales.ts'
export type { NotesPanelActions } from './slots.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The sticky-notes panel's copy. */
    notes: import('./locales.ts').NotesKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'notes'

/** Required services: the slot registry, session scope, notes Remote, and copy. */
export const inject = ['slots', 'sessions', 'remote', 'remote.notes', 'locale']

/**
 * Client plugin body: the body-utilities entry pairing the trigger with its
 * dropdown panel under one anchor.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-notes: dictionaries')
  const store = createNotesStore()

  ctx.slots.inject('conversation.session.body.utilities', () => ctx.slots.register({
    name: 'conversation.session.body.utilities',
    id: 'notes',
    locale: NS,
    store,
    inject: (sessionId: SessionId): NotesPanelActions => ({
      put: async request => await ctx.remote.notes.put(sessionId, request),
      remove: async id => await ctx.remote.notes.delete(sessionId, id),
      setInject: async enabled => await ctx.remote.notes.setInject(sessionId, enabled),
      importAll: async () => await ctx.remote.notes.import(sessionId, {}),
    }),
  }, NotesUtility))
}
