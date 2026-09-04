# notes/ — session sticky notes

English | [中文](README.zh.md)

User-owned per-session sticky notes persisted entirely in the owning session log. Notes reach the model only through the two import paths (context injection and one-shot user message); there is no model-facing tool.

| Package | Role | ctx key |
|---|---|---|
| [`notes/`](notes/README.md) | Notes state, service, projection, and `notes:context` section | `ctx.notes` |

The subsystem reference — data model, service behavior, and event sourcing — is [docs/subsystems/notes.md](../../docs/subsystems/notes.md).
