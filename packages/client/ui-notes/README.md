# @deepseek-ai/dsh-client-ui-notes

English | [中文](README.zh.md)

Sticky-notes surface plugin, browser half: one entry in the session body's utility strip (`conversation.session.body.utilities`) — a noty-style trigger with its dropdown panel hanging under it, right-aligned between the header divider and the message area — over the `notes` projection. The notes themselves arrive through `useProjection('notes')` — the host-computed whole `NotesState` — so the plugin owns no durable state; its session-scoped store holds only interaction state (panel open, editor draft, last error). The slot inject face carries the four notes verbs (`put` / `delete` / `setInject` / `import` through `ctx.remote.notes`); a rejected Remote verb surfaces verbatim through the store's error line while a successful save closes the editor. The panel lists notes oldest created first — the top-to-bottom task queue; each card offers pin, inline edit, and delete, and the header holds the execute-tasks switch (disabled while no notes exist), the one-shot import button (disabled while no notes exist), and the close control.

The `/client` exports are the plugin body (`apply`/`inject`), the `createNotesStore` factory, and the injected verb face type.

## Model Experience

Indirectly, through the `put`, `delete`, `setInject`, and `import` Remote methods the panel invokes: the first two commit per-item `note/put` / `note/delete` session events, the third commits `note/inject` and hands the queue to the host's execute loop, and the import composes one user-message steer. The plugin itself adds no prompt content.

#### KV Cache effect

None directly. While the recorded execution switch is on, any note mutation rewrites the host-rendered `notes:context` section and invalidates prefix-cache reuse from that section onward — the [notes package README](../../notes/notes/README.md) owns that contract.

## Known Limitations and Deferred Work

- **No optimistic writes** — the panel renders the projection only after the Remote verb commits; a slow round trip leaves the editor open with no local echo of the pending item.
- **Panel-local interaction state only** — open/editor/error state lives in the session-scoped store and resets on reload; there is no persistence and no cross-tab sync.
