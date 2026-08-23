# Agent Note: Workspace Browser Exposes a Header-Action Slot

Status: implemented

English | [中文](2026-08-23-workspace-header-action-slot.zh.md)

## Problem

The sidebar workspace browser's header has three hardcoded controls — search, view options, and add workspace — with no way for a feature plugin to add its own header action (for example, a file-tree toggle). A plugin that wanted a header icon had to replace the whole `sidebar.workspaces` region, which discards the shipped session browser.

## Decision

`ui-workspace` declares `sidebar.workspaces.action`, a `list` slot of root scope, rendered in the header's `headerActions` row after the add-workspace button. Entries receive `{ wide }` owner props so they render the wide 16px icon or the rail 18px icon. The slot is additive (`replaceRisk: none`), so feature plugins contribute icons without replacing the browser; the file-tree plugin registers its toggle there.

## Alternatives considered

**Hardcode the file-tree icon in the browser.** Rejected: it couples the shipped browser to one feature; a slot lets any feature add a header action.

**Reuse an existing slot.** Rejected: the only child slot under `sidebar.workspaces` is the directory-flow hole — a single picking surface, not a header-action row.

## Consequences

- `sidebar.workspaces.action` is a new public extension point; entries get `{ wide }` and render their own icon geometry.
- The shipped workspace browser remains intact; the file-tree plugin's toggle rides the slot and appears in both wide and rail states.
