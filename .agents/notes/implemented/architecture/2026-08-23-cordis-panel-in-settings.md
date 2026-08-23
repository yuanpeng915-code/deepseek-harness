# Agent Note: Cordis Panel Lives in Settings, Not the Sidebar Footer

Status: implemented

English | [中文](2026-08-23-cordis-panel-in-settings.zh.md)

## Problem

The dynamic Cordis plugin surface (inventory, approvals, versions, run/stop/remove) rendered as a sidebar-foot action: a "Cordis Plugin N running" badge that opened a 420px fixed-position popover anchored to the badge. The foot also hosted other additive actions, so the shipped footer stacked two rows — actions above Settings — and the developer-facing Cordis controls occupied prime chrome. Users wanted those controls tucked into Settings and the footer reduced to Settings plus a compact additive action aligned to its right.

## Decision

`ui-cordis` registers the Cordis inventory as a `settings.plugins.tab` entry (id `dynamic`, order `20`, label "Dynamic plugins" / "动态插件") instead of a `sidebar.footer.action` entry. The `CordisPanel` component now renders inline as a tab page: the badge, fixed-position popover, outside-pointer dismissal, and approval auto-open are removed; the inventory list, version picker, approval/run/stop/remove actions, and per-row errors remain unchanged. `ui-cordis` swaps its `@deepseek-ai/dsh-client-ui-sidebar` dependency for `@deepseek-ai/dsh-client-ui-settings` (the `settings.plugins.tab` slot type's home).

`ui-sidebar`'s foot is now a horizontal row: `sidebar.settings` on the left (`flex: 1`) and `sidebar.footer.action` on the right (`flex: none`), so a compact additive action sits to the right of Settings on the same baseline. The collapsed rail keeps the centered vertical stack.

## Alternatives considered

**Keep the footer popover and only add a Settings link.** Rejected: two entry points to one inventory invite drift, and the badge's running/approval count would lose its only surface.

**Register the panel as a top-level `settings.section`.** Rejected: the existing Plugins section already groups plugin surfaces; a tab there reuses its navigation without competing for a Settings nav row.

**Keep the badge and also render the inventory inline.** Rejected: it would duplicate the inventory logic and state between two components.

## Consequences

- The "Cordis Plugin N running" badge and its approval auto-open are gone; approval is now visible at Settings → Plugins → Dynamic plugins.
- `sidebar.footer.action` is empty in the shipped composition and becomes the reserved seat for compact additive actions (such as the model-board chip) aligned to the right of Settings.
- `ui-cordis` drops its `@deepseek-ai/dsh-client-ui-sidebar` dependency and gains `@deepseek-ai/dsh-client-ui-settings`; the client slot catalog regenerates with the CordisPanel occupant listed under `settings.plugins.tab`.

## Related

- [Cordis Host/Client Dynamic Plugin Runtime](../../proposed/architecture/2026-08-08-cordis-web-dynamic-packages.md) — the runtime `ui-cordis` belongs to; this note fixes where its global panel lives.
