# Agent Note: Plugin-Configuration Cards Use the Shared SettingsCard Primitive

Status: implemented

English | [中文](2026-08-23-plugin-config-card-spec.zh.md)

## Problem

The Settings → Plugins tabs (configurable plugins, plugin list, dynamic plugins) each redefined the same card chrome — the 760px column width and the border/radius/surface tokens of one plugin card — in three separate CSS modules. The duplication drifted (12px vs 10px radius) and invited each new plugin-configuration UI to invent another variant.

## Decision

The card chrome lives in one shared primitive pair in `ui-primitives`: `SettingsCard` (border `--dsw-alias-border-l2`, radius 10px, background `--dsw-alias-bg-layer-3`, `open` highlight to `border-l1` + `bg-layer-2`, plus a `data-open` marker) and `SettingsCardSection` (the 760px column). The primitive owns only chrome; content layout (padding, gaps, header/body) stays in the feature's CSS module through the card's `className`. `ui-cordis`'s `CordisPanel` (the dynamic-plugins tab) consumes both primitives. The spec is documented in [`docs/web-styling.md`](../../../docs/web-styling.md) under "Plugin configuration cards".

## Alternatives considered

**Document the tokens only, with no shared code.** Rejected: prose alone does not stop drift; a shared primitive makes following the spec the default.

**Extract a full card component (header, body, details).** Rejected: the three tabs carry different content; only the chrome is common, and one imposed structure would force an awkward fit.

**A global style sheet in `ui-theme`.** Rejected: the chrome is a component surface, not a cross-cutting concern like scrollbars or resets, so it belongs in the shared component package.

## Consequences

- New plugin-configuration UIs compose `SettingsCard`/`SettingsCardSection`; redefining the chrome is the deviation to justify.
- `ui-cordis` drops its local `.row`/`.inline` chrome and keeps only content layout. `ui-settings-plugin-inventory` and `ui-settings-plugins` still define local card chrome that matches the spec; they are migration targets.
- `SettingsCard` exposes `data-open` so tests and CSS selectors observe the open state without reading hashed class names.

## Related

- [Cordis Panel Lives in Settings, Not the Sidebar Footer](./2026-08-23-cordis-panel-in-settings.md) — the move that put the dynamic-plugins surface in a Settings tab, whose card chrome this note consolidates.
