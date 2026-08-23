# Agent Note: Model Board and File Tree Ship as Web Composition Packages

Status: implemented

English | [中文](2026-08-23-model-board-file-tree-packages.zh.md)

## Problem

The model pricing board and the workspace file tree existed as session-local dynamic Cordis plugins: defined and authorized by the agent at runtime, lost on every service restart, and absent from Settings → Plugins → Plugin list. Their UI depended on dynamic-only APIs (`harness.handle`, `host.call`, `styles.insert`) and the file tree reached the Host filesystem only through a per-run private handler.

## Decision

Both surfaces ship as ordinary composition packages registered in the web bundle:

- `@deepseek-ai/dsh-client-ui-model-board` — client-only. The pricing schedule and model prices are embedded constants; phase computation lives in a pure `pricing.ts` module. Registers `sidebar.footer.action` (footer cell) and `shell.overlay` (popover) on one `createBoardStore()` hover store.
- `@deepseek-ai/dsh-host-file-tree` — a `TypertRemoteService` (`remote.fileTree`) whose `@Remote('tree')` method lists a workspace directory as a breadth-first nested tree through `fs`, skipping build/VCS/cache directories and capping depth (12) and entries (5000).
- `@deepseek-ai/dsh-client-ui-file-tree` — registers the workspace header toggle (`sidebar.workspaces.action`), the overlay drawer (`shell.overlay`), and a session-scoped insert bridge (`conversation.input.right`) that appends a chosen path to the composer draft. The drawer reads the tree through `remote.fileTree.tree`, mounted by `api-remotes`.

## Alternatives considered

**Keep them dynamic.** Rejected: they vanish on restart and never appear in the plugin list, which is the requirement being addressed.

**Inline the file tree into `ui-workspace`.** Rejected: it would couple the shipped workspace browser to one feature; the header-action slot keeps the browser feature-agnostic.

**Expose the directory listing through a bespoke HTTP route.** Rejected: the established `TypertRemoteService` path already carries authorization, the generated client face, and teardown.

## Consequences

- Both surfaces auto-load on service start and appear in Settings → Plugins → Plugin list; the old dynamic plugins can be retired.
- The file tree's filesystem access is a read-only, bounded Host Remote rather than an unbounded per-run handler.
- `api-remotes` gains the `fileTree` namespace; the new client package injects `remote.fileTree` alongside the standard `remote` service.
