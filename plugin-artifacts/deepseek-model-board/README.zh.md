# DeepSeek 模型看板插件（deepseek-model-board）

[English](README.md) | 中文

DSH Web 左下角**设置按钮右侧**的模型看板组件（侧边栏脚部布局已改为「设置居左、附加动作居右」）。当前内置「峰谷定价」看板：常驻显示当前时段处于哪个阶段（高峰/低谷）及对应价格，鼠标悬停弹出浮层展示全部定价时段的详细信息。组件采用「看板注册表 + 按类型分发的渲染器」架构，便于后续扩展更多看板功能。

- 插件 ID：`board-2`（原 `board-1` 被误删后按 `plugin-source.js` 重新创建）
- 当前包：`board-2/pkg-4`（动态 Cordis 插件，进程级，重启后需按源码重新定义，见 `plugin-source.js`）
- 数据口径：DeepSeek 官方计费公告，2026-08-23 生效，北京时间

---

## 1. 功能说明

| 交互 | 行为 |
| --- | --- |
| 常驻按钮 | 位于侧边栏底部设置按钮**右侧**（`sidebar.footer.action` 插槽，现渲染在 Settings 右边）。宽栏显示「⦿ 低谷 ¥13.5」形式的阶段 + 输出价格；窄栏（56px rail）只显示阶段圆点 |
| 阶段圆点 | 高峰 = 橙色（`--dsw-alias-state-warn-primary`），低谷 = 绿色（`--dsw-alias-state-success-primary`），随主题切换 |
| 鼠标悬停 | 弹出看板浮层（`shell.overlay` 框架级浮层，不被侧边栏滚动容器裁剪），自动定位在按钮上方 |
| 浮层内容 | ① 当前时段卡片：阶段、输出价格、缓存命中输入价格、下次切换倒计时（周末额外显示「周末统一低谷价」徽标）；② 全部定价时段明细：工作日各时段 + 价格、周末全天低谷价规则；③ 数据来源与生效日期脚注 |
| 键盘可达 | 按钮可聚焦（Tab），聚焦/失焦等价于悬停开/关；带 `aria-label` |
| 自动刷新 | 阶段与倒计时每 30s 按**北京时间**（`Intl` 时区计算）重新判定，与本地时区无关 |

当前内置的峰谷规则（DeepSeek 官方公告，2026-08-23 生效）：

- 工作日（周一至周五）：高峰时段为北京时间 09:00–12:00、14:00–18:00；其余时间为低谷时段
- 低谷价格为高峰价格的 50%
- 周末（周六、周日）：全天统一按低谷价计费

内置模型示例（DeepSeek-V4-Pro，单位 元 / 百万 tokens）：

| 项目 | 高峰 | 低谷 |
| --- | --- | --- |
| 输出 | ¥27.0 | ¥13.5 |
| 缓存命中输入 | ¥0.30 | ¥0.15 |

## 2. 架构

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

- **数据方向**：数据只存 Host 注册表；Client 通过 Package-private RPC 拉取纯 JSON 快照，阶段判定在 Client 本地完成（快照含 schedule，Client 每 30s 重算）。
- **生命周期**：所有注册（`slots.inject/register`、`styles.insert`、`harness.handle`、`ctx.interval/timeout`）都挂在 Cordis Fiber 上，`cordis_stop` / 更新 / 删除时自动清理；Client 声明 `inject: ['timer']` 使用定时器。
- **样式**：全部使用主题 CSS 变量（`--dsw-alias-*`），自动适配亮/暗主题，不覆盖全局主题。

## 3. 数据模型

快照（`board:snapshot` 返回值）：

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

约定：

- 阶段取值只有 `'peak' | 'offPeak'`，由 `schedule` 推导（先判周末，再判工作日高峰窗口）。
- 价格字段中 `output` 必填；`inputCacheHit` / `inputCacheMiss` 可选，缺省时 UI 不渲染对应价格行（当前内置数据仅含官方公布的输出价与缓存命中输入价）。

## 4. 扩展指南

### 4.1 更新价格 / 时段（DeepSeek 再次调价时）

数据是代码内常量（动态插件无持久化配置）。修改 Host half 中 `boards[0]` 的 `schedule` / `models`，然后：

1. `cordis_define`（kind: existing，pluginId `board-1`）追加新 Package；
2. `cordis_run`（mode: `update`）切换到新包。

改动只影响展示数据，无需动 Client 代码。

### 4.2 新增模型

在 pricing 看板的 `models` 数组追加一项（id / name / unit / prices）。浮层头部会自动展示 `model.name`；若后续有多个模型，可在浮层中自行加选择器（当前固定取 `models[0]`）。

### 4.3 调整峰谷规则

- `weekdayPeakWindows`：工作日高峰窗口（`HH:MM`，可多段）；
- `weekendAllOffPeak`：周末是否统一低谷；
- `offPeakFactor`：低谷价相对高峰价的比例（浮层脚注按它显示百分比）。

### 4.4 新增看板（核心扩展点，两步）

1. **Host**：向 `boards[]` 追加一项，例如 `{ id: 'usage', kind: 'usage', title: '用量统计', description: '…', ...自有数据 }`；
2. **Client**：在渲染器注册表登记 `renderers['usage'] = (board, opts) => React.createElement(UsageView, { board, now: opts.now, key: opts.key, meta: opts.meta })`，并实现 `UsageView` 组件。

浮层会按 `kind` 自动分发渲染；未登记渲染器的看板会显示占位提示而不是崩溃。多个看板在浮层内自上而下堆叠。

> 说明：按钮（BoardButton）目前固定展示 pricing 看板摘要。若新看板也需要在按钮上露出摘要，扩展 BoardButton 的逻辑即可（例如按 store 中「当前激活看板」切换）。

### 4.5 未来扩展方向（示例）

| 方向 | 做法 |
| --- | --- |
| 模型可见工具 | Host 用 `harness.registerTool` 注册只读工具（如返回看板摘要），让模型在对话中也能查询定价 |
| 实时价格 | Host 用 `web` Service 定时 fetch 官方定价页并解析，通过快照 RPC 推给 Client（替换内置常量数据源） |
| 用量 / 成本看板 | 新看板从 `sessionQuery` / `sessionPersistence` 聚合 token 用量与估算成本，展示在浮层 |
| 多模型切换 | pricing 看板内加模型下拉，`models` 数组已支持 |
| 站点通知 / 状态看板 | 复用同一浮层与 `renderers` 机制，新增 `kind` 即可 |

## 5. 使用与维护

- **首次启动**：`cordis_run`（mode: run）后需在 Web GUI 的 Run 卡片批准（首次授权只针对当前包）。
- **更新**：`cordis_define` 追加包 → `cordis_run`（mode: update）。
- **停用**：`cordis_stop`（保留版本，可随时重启）。
- **删除**：`cordis_undefine`（永久移除，含历史业务视图）。
- **重启后恢复**：动态插件是进程级的，DSH 重启后需按 `plugin-source.js` 中的源码重新 `cordis_define` + `cordis_run`。

## 6. 源码

完整可复现源码见同目录 [`plugin-source.js`](./plugin-source.js)（Host half 与 Client half 两个函数体，可直接用于 `cordis_define` 的 `code.host` / `code.client`）。

## 7. 版本记录与验证

| 包 | 说明 |
| --- | --- |
| `pkg-1` | 初版（Client 引用未定义的 CSS 常量，未运行） |
| `pkg-2` | 修复 CSS 常量；经真实页面验证：按钮与浮层正常渲染（当前阶段、价格、倒计时、全部时段、周末规则） |
| `pkg-3` | 修复午间低谷时段标签（`12:00 – 24:00` → `12:00 – 14:00`）与价格尾零（`13.50` → `13.5`）；经真实页面复验通过 |
| `pkg-4` | 原 `board-1` 被误删后按 `plugin-source.js` 重新创建（新插件 `board-2`），源码与 `pkg-3` 一致 |

验证方式：保持一个浏览器页面连接 DSH Web，`cordis_run`（run/update）将 Client 半投递给已连接的页面（新打开的页面不会重放已激活的动态插件），再对页面截图/读取浮层文本确认。
