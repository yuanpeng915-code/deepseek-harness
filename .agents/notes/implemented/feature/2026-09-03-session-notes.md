# Agent Note: Session sticky notes

Status: implemented

English | [中文](2026-09-03-session-notes.zh.md)

## Problem

A conversation needs a user-owned scratchpad: small text fragments the user wants to keep in front of themselves and, on demand, put in front of the model — without promoting every draft into a message. Nothing in the harness carried per-session user notes: the todo list is model-owned, goals are model-lifecycle state, and the composer draft is ephemeral. The reference experience is [noty](https://github.com/aimen08/noty)'s colored paper notes pinned to the screen edge.

## Decision

Session sticky notes ship as one host plugin plus one browser plugin, mounted only in the `web-app` bundle:

- `@deepseek-ai/dsh-notes` (`ctx.notes`, [packages/notes/notes](../../../../packages/notes/notes)) owns the state. Every mutation is an individual log-only `SessionEventMap` event — `note/put` (upsert with color and pinned), `note/delete`, `note/inject` — so the durable state lives entirely in the owning session log and replays from it. The service folds events on demand into a `notes` projection unit and exposes four Remote verbs (`put`, `delete`, `setInject`, `import`) as a per-session Typert service. Failures are explicit `NoteError`s with stable `notes-*` codes; there is no silent skip.
- The model meets notes only through two user-initiated paths: the `notes:context` system-prompt section (order 60), which renders the folded notes when the recorded inject flag is on, and the one-shot `import` verb, which composes the selected notes into a single steered user message. Colors, ids, and timestamps never render into model-visible text.
- `@deepseek-ai/dsh-client-ui-notes` ([packages/client/ui-notes](../../../../packages/client/ui-notes)) provides the noty-styled panel: one entry on the new `conversation.session.body.utilities` strip ui-conversation pins between the header divider and the scrollport, pairing the trigger with its dropdown panel, with add/edit/delete, the six-color noty palette, pinning, the inject toggle, and the import button. The panel reads the projection directly and calls the four verbs.

## Alternatives considered

- **Why not model-facing tools?** A `notes_*` tool family would let the agent read and write the scratchpad itself, but notes are user-owned drafts; a tool face costs a tool-catalog entry, boot manifest wiring, and snapshot coverage, and no current consumer needs model-initiated access. Deferred; the limitation is recorded in the package README.
- **Why not a whole-snapshot event (the todo pattern)?** One `notes/snapshot` event per change is simpler but rewrites the entire list on every keystroke-committed edit and makes concurrent panel edits last-writer-wins on the whole list. Individual events merge per item.
- **Why not materialize notes as a context message (`ctx.systemPrompt.context`)?** It would duplicate the import path as a user-role message re-sent every step, competing with the deliberate one-shot import, and bloat every request.
- **Why not browser localStorage?** Notes must follow the conversation across devices and survive the browser; the session log is the only store the harness already treats as durable per-session state.

## Consequences

The inject path trades prefix-cache stability for always-fresh context: with the flag on, every note edit rewrites the `notes:context` section text and invalidates prefix reuse from that section onward. `put` is unconditional replacement — two concurrent editors of one note resolve last-writer-wins; there is no compare-and-set. The web panel is the only writer, so the host plugin mounts only in the web-app bundle and headless assemblies are unaffected; a future CLI or model-facing writer would need its own mount decision.

## Related

The per-item event, fold-on-demand projection, and per-session Typert service patterns follow the goal subsystem ([docs/subsystems/goal.md](../../../../docs/subsystems/goal.md)); the data-model and service reference is [docs/subsystems/notes.md](../../../../docs/subsystems/notes.md).
