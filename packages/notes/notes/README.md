# @deepseek-ai/dsh-notes

English | [中文](README.zh.md)

Session-scoped sticky notes: a user-owned per-conversation scratchpad whose durable state lives entirely in the owning session log. The service folds state on demand from per-item `note/put` / `note/delete` / `note/inject` events and serves the web panel's mutation verbs; notes reach the model only through the two import seams. The [notes subsystem page](../../../docs/subsystems/notes.md) records the literal data shapes.

## Config

```yaml
- id: notes
  name: '@deepseek-ai/dsh-notes'
  config:
    maxNoteBytes: 4096
    maxNotes: 100
```

`maxNoteBytes` (UTF-8 bytes per note body) and `maxNotes` (notes retained per session) must each be positive safe integers; a violation fails at plugin load.

## Service contract

`ctx.notes` accepts only the exact live `Agent` instance registered under its id. `put` creates a note (service-assigned id, default color `yellow`, unpinned) or replaces one by id, keeping the recorded color and pin state where the request omits them and clamping `updatedAt` against backward wall-clock movement. `delete` rejects an unknown id instead of no-oping. `setInject` records the injection switch and skips the event when the recorded state already matches. `importAsMessage` composes the selected notes — all of them when the request omits `ids`, pinned first — into one user-message steer the model sees on its next turn, and rejects an unknown id or an empty selection. Every failure is a `NoteError` with a stable `notes-*` code; nothing is silently skipped. The callable API is the generated region of [notes.md](../../../docs/subsystems/notes.md#cordis-surface).

The service contributes the `notes` projection unit (whole-`NotesState` value) and the `notes:context` system-prompt section (order 60), whose text is the folded notes only while the recorded switch is on; an off switch leaves the section empty. Both children activate only when the corresponding registry is composed, so headless assemblies stay unaffected.

The separately published `./invariant` companion rejects malformed `note/put` payloads (blank text, unknown color, non-monotonic timestamps), a `note/delete` naming an absent id, and malformed `note/inject` payloads before the candidate event enters the durable log.

## Extension points

Consumer plugins call the service verbs and read the `notes` projection; the web surface (`@deepseek-ai/dsh-client-ui-notes`) owns the panel UI and the two import paths' user-facing triggers. There are no tool or command surfaces.

## Model Experience

### Context injection (`notes:context` section)

#### What the model sees

While the session's recorded switch is on, each model request carries a system-prompt section whose text renders the folded notes: a heading followed by one bullet per note, pinned first and oldest created first, each line prefixed `[pinned] ` when the note is pinned. Colors, ids, and timestamps are absent from the rendered text. With the switch off — or with no notes — the section contributes no text.

##### Verbatim text for this field, when needed

```markdown
The user's sticky notes for this conversation (pinned first):

- <[pinned] >note text
```

#### Token effect

Conditional fixed-plus-linear: an empty section contributes no tokens; with the switch on the section adds the rendered note lines and grows with note count and text length up to the configured bounds (`maxNotes` notes of `maxNoteBytes` bytes each).

#### KV Cache effect

The section sits in the system prompt's ordered section list, so toggling the switch or any note edit replaces previously rendered section text and invalidates prefix-cache reuse from that point on. With the switch off the section stays empty and preserves the surrounding prefix.

### Import as user message (`import` Remote)

#### What the model sees

One user message whose text opens with a preamble line followed by the same pinned-first `[pinned] `-prefixed bullets. The message enters the conversation like any other user turn.

##### Verbatim text for this field, when needed

```markdown
Here are my sticky notes to bring into this conversation:

- <[pinned] >note text
```

#### Token effect

One-shot linear growth: the composed message adds tokens proportional to the selected notes' text and remains in the transcript thereafter.

#### KV Cache effect

Append-only: the message extends the history tail; later note edits do not rewrite it.

## Known Limitations and Deferred Work

- **No model tools** — the agent cannot read or write notes itself; both import paths are user-initiated. A model-facing tool surface would need a tool catalog entry, a boot manifest, and snapshot coverage.
- **No compare-and-set** — `put` replaces unconditionally, so two concurrent editors of one note last-writer-wins; cross-client conflict detection is deferred.
- **Prefix-cache invalidation while injecting** — with the switch on, every note mutation rewrites the `notes:context` section text and invalidates provider prefix-cache reuse from the section onward.
