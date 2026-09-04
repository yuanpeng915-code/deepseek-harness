# DeepSeek model board plugin (deepseek-model-board)

English | [中文](README.zh.md)

A model board component to the **right of the sidebar Settings trigger** in the bottom-left of the DSH web app (the sidebar footer layout is now "Settings on the left, extra actions on the right"). The built-in board is the "peak/off-peak pricing" board: it permanently shows the current pricing phase (peak/off-peak) and its price, and hovering opens an overlay with the full pricing schedule. The component uses a "board registry + renderer dispatch by kind" architecture, ready for more board features later.

- Plugin id: `board-2` (`board-1` was accidentally deleted and re-created from `plugin-source.js`)
- Current package: `board-2/pkg-4` (dynamic Cordis plugin, process-level; after a restart it must be re-defined from the source, see `plugin-source.js`)
- Data basis: DeepSeek official pricing announcement, effective 2026-08-23, Beijing time

---

## 1. Features

| Interaction | Behavior |
| --- | --- |
| Persistent button | To the **right** of the sidebar's bottom Settings button (`sidebar.footer.action` slot, rendered next to Settings). Wide rail shows "⦿ Off-peak ¥13.5" (phase + output price); the narrow 56px rail shows only the phase dot |
| Phase dot | Peak = orange (`--dsw-alias-state-warn-primary`), off-peak = green (`--dsw-alias-state-success-primary`), theme-aware |
| Hover | Opens the board overlay (`shell.overlay` framework-level float, not clipped by the sidebar's scroll container), positioned above the button |
| Overlay content | ① Current-phase card: phase, output price, cache-hit input price, countdown to the next switch (weekends additionally show a "weekend unified off-peak price" badge); ② full schedule details: weekday windows + prices, weekend all-off-peak rule; ③ source and effective-date footnote |
| Keyboard access | The button is focusable (Tab); focus/blur is equivalent to hover on/off; carries an `aria-label` |
| Auto refresh | Phase and countdown re-evaluate every 30s on the **Beijing clock** (`Intl` timezone computation), independent of the local timezone |

The built-in peak/off-peak rules (DeepSeek official announcement, effective 2026-08-23):

- Weekdays (Mon–Fri): peak windows are 09:00–12:00 and 14:00–18:00 Beijing time; all other times are off-peak
- The off-peak price is 50% of the peak price
- Weekends (Sat, Sun): all day is billed at the off-peak price

Built-in model example (DeepSeek-V4-Pro, unit: yuan per million tokens):

| Item | Peak | Off-peak |
| --- | --- | --- |
| Output | ¥27.0 | ¥13.5 |
| Cache-hit input | ¥0.30 | ¥0.15 |

## 2. Architecture

```
┌─ Host half (Node process) ─────────────────────────┐
│ Board registry boards[] (built-in pricing board,   │
│   with schedule and price data)                    │
│   └─ Private RPC: harness.handle('board:snapshot') │
└────────────────────────────────────────────────────┘
        │ host.call('board:snapshot') (Client→Host JSON)
        ▼
┌─ Client half (browser page) ───────────────────────┐
│ Shared store (snapshot / open / anchor, closure     │
│ subscription)                                       │
│ ├─ sidebar.footer.action  →  BoardButton (phase+price)│
│ ├─ shell.overlay          →  BoardPanel (overlay)   │
│ └─ renderers{ kind: view }  ← dispatch by kind      │
│     pricing → PricingBoardView                      │
└────────────────────────────────────────────────────┘
```

- **Data direction**: data lives only in the Host registry; the Client pulls a pure JSON snapshot through the package-private RPC, and phase determination happens locally on the Client (the snapshot carries the schedule; the Client recomputes every 30s).
- **Lifecycle**: every registration (`slots.inject/register`, `styles.insert`, `harness.handle`, `ctx.interval/timeout`) rides the Cordis Fiber and is cleaned up automatically on `cordis_stop`, update, or deletion; the Client declares `inject: ['timer']` for timers.
- **Styling**: everything uses theme CSS variables (`--dsw-alias-*`), adapting to light/dark automatically, and never overrides the global theme.

## 3. Data model

The snapshot (the `board:snapshot` return value):

```ts
interface Snapshot {
  version: number          // 1
  generatedAt: string      // ISO time
  timezoneLabel: string    // '北京时间 (UTC+8)'
  source: string           // data-source description
  sourceUrl: string        // official pricing page
  updatedAt: string        // effective date '2026-08-23'
  boards: Board[]
}

interface Board {
  id: string               // unique id, e.g. 'pricing'
  kind: string             // render kind; the Client dispatches a renderer by it, e.g. 'pricing'
  title: string            // board title
  description: string      // one-line description
  [extra: string]: unknown // board-owned data, differs by kind
}

// The pricing board's own data
interface PricingBoardData {
  schedule: {
    timezone: string            // 'Asia/Shanghai'
    weekdayPeakWindows: Array<{ start: string; end: string }>  // 'HH:MM', Beijing time
    weekendAllOffPeak: boolean  // weekends all off-peak
    offPeakFactor: number       // off-peak = peak × factor (0.5)
  }
  models: Array<{
    id: string
    name: string                // display name, e.g. 'DeepSeek-V4-Pro'
    unit: string                // '元 / 百万 tokens'
    prices: {
      peak:    { inputCacheHit?: number; inputCacheMiss?: number; output: number }
      offPeak: { inputCacheHit?: number; inputCacheMiss?: number; output: number }
    }
  }>
}
```

Conventions:

- The phase is only `'peak' | 'offPeak'`, derived from `schedule` (weekend first, then weekday peak windows).
- Among price fields, `output` is required; `inputCacheHit` / `inputCacheMiss` are optional, and the UI omits those rows when absent (the built-in data currently carries only the officially published output and cache-hit input prices).

## 4. Extension guide

### 4.1 Update prices / windows (when DeepSeek reprices)

Data is an in-code constant (a dynamic plugin has no persisted config). Edit `boards[0]`'s `schedule` / `models` in the Host half, then:

1. `cordis_define` (kind: existing, pluginId `board-1`) to append a new package;
2. `cordis_run` (mode: `update`) to switch to the new package.

The change only affects display data; no Client code changes.

### 4.2 Add a model

Append one entry (id / name / unit / prices) to the pricing board's `models` array. The overlay header automatically shows `model.name`; with several models later, add a selector in the overlay (it currently always takes `models[0]`).

### 4.3 Adjust the peak/off-peak rules

- `weekdayPeakWindows`: weekday peak windows (`HH:MM`, multiple allowed);
- `weekendAllOffPeak`: whether weekends are uniformly off-peak;
- `offPeakFactor`: the off-peak-to-peak ratio (the overlay footnote shows the percentage from it).

### 4.4 Add a board (the core extension point, two steps)

1. **Host**: append one entry to `boards[]`, e.g. `{ id: 'usage', kind: 'usage', title: 'Usage', description: '…', ...own data }`;
2. **Client**: register a renderer — `renderers['usage'] = (board, opts) => React.createElement(UsageView, { board, now: opts.now, key: opts.key, meta: opts.meta })` — and implement the `UsageView` component.

The overlay dispatches by `kind` automatically; a board with no registered renderer shows a placeholder instead of crashing. Multiple boards stack top-down inside the overlay.

> Note: the button (BoardButton) currently always shows the pricing board's summary. If a new board should also surface a summary on the button, extend BoardButton's logic (for example, switching on the store's "currently active board").

### 4.5 Future directions (examples)

| Direction | Approach |
| --- | --- |
| Model-visible tool | Register a read-only tool via `harness.registerTool` (e.g. returning a board summary) so the model can query pricing in conversation |
| Live prices | Use the `web` Service on the Host to fetch and parse the official pricing page on a schedule, pushing it to the Client through the snapshot RPC (replacing the built-in constants) |
| Usage / cost board | A new board aggregates token usage and estimated cost from `sessionQuery` / `sessionPersistence` and shows it in the overlay |
| Multi-model switching | Add a model dropdown inside the pricing board; `models` already supports it |
| Site notice / status board | Reuse the same overlay and `renderers` mechanism with a new `kind` |

## 5. Usage and maintenance

- **First start**: after `cordis_run` (mode: run), approve in the web GUI's Run card (the first authorization is scoped to the current package).
- **Update**: `cordis_define` appends a package → `cordis_run` (mode: update).
- **Disable**: `cordis_stop` (keeps versions; can be restarted any time).
- **Delete**: `cordis_undefine` (permanently removes, including historical board views).
- **Recover after restart**: dynamic plugins are process-level; after a DSH restart, re-run `cordis_define` + `cordis_run` from the source in `plugin-source.js`.

## 6. Source

The complete reproducible source lives in [`plugin-source.js`](./plugin-source.js) alongside this file (the Host half and Client half function bodies, ready for `cordis_define`'s `code.host` / `code.client`).

## 7. Version history and verification

| Package | Notes |
| --- | --- |
| `pkg-1` | Initial version (the Client referenced an undefined CSS constant; never ran) |
| `pkg-2` | Fixed the CSS constant; verified on a real page: button and overlay render correctly (current phase, price, countdown, all windows, weekend rule) |
| `pkg-3` | Fixed the midday off-peak label (`12:00 – 24:00` → `12:00 – 14:00`) and price trailing zeros (`13.50` → `13.5`); re-verified on a real page |
| `pkg-4` | Re-created from `plugin-source.js` after `board-1` was accidentally deleted (new plugin `board-2`); source identical to `pkg-3` |

Verification method: keep one browser page connected to the DSH web app, `cordis_run` (run/update) to deliver the Client half to the connected page (a newly opened page does not replay activated dynamic plugins), then screenshot the page / read the overlay text to confirm.
