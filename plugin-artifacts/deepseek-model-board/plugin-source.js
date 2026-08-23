/**
 * deepseek-model-board (board-2 / pkg-4)
 * DSH Web 左下角设置按钮右侧的模型看板插件。
 *
 * 使用方式（DSH 重启后恢复）：
 *   cordis_define 时，把下方 hostBody / clientBody 分别填入 code.host / code.client，
 *   然后 cordis_run（首次需在 Web GUI 批准）。
 *
 * 文档见 README.md（功能说明、数据模型、扩展指南）。
 */

// ============================================================
// Host half（填入 cordis_define 的 code.host）
// ============================================================
const hostBody = `return {
  apply(ctx) {
    // ---- 看板注册表（扩展点：向此数组追加新看板即可扩展）----
    const boards = [
      {
        id: 'pricing',
        kind: 'pricing',
        title: '模型峰谷定价',
        description: 'DeepSeek API 峰谷动态定价看板',
        schedule: {
          timezone: 'Asia/Shanghai',
          weekdayPeakWindows: [
            { start: '09:00', end: '12:00' },
            { start: '14:00', end: '18:00' },
          ],
          weekendAllOffPeak: true,
          offPeakFactor: 0.5,
        },
        models: [
          {
            id: 'deepseek-v4-pro',
            name: 'DeepSeek-V4-Pro',
            unit: '元 / 百万 tokens',
            prices: {
              peak: { inputCacheHit: 0.3, output: 27.0 },
              offPeak: { inputCacheHit: 0.15, output: 13.5 },
            },
          },
        ],
      },
    ]

    // 快照为纯 JSON，仅含可序列化数据
    const snapshot = () => ({
      version: 1,
      generatedAt: new Date().toISOString(),
      timezoneLabel: '北京时间 (UTC+8)',
      source: 'DeepSeek 官方计费公告',
      sourceUrl: 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing',
      updatedAt: '2026-08-23',
      boards,
    })

    // 私有 RPC：Client 拉取看板快照（Package-private，方向 Client→Host）
    ctx.effect(() => harness.handle('board:snapshot', async () => snapshot()))

    console.log('模型看板插件已启动，内置看板: ' + boards.map((b) => b.id).join(', '))
  },
}`

// ============================================================
// Client half（填入 cordis_define 的 code.client）
// ============================================================
const clientBody = `return {
  inject: ['timer'],
  apply(ctx) {
    const CSS = \`
.dsh-board-cell{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border-radius:8px;color:var(--dsw-alias-label-secondary);font-size:12px;user-select:none;cursor:default;white-space:nowrap;box-sizing:border-box;}
.dsh-board-cell:hover,.dsh-board-cell.open{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);}
.dsh-board-cell:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}
.dsh-board-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none;}
.dsh-board-dot.peak{background:var(--dsw-alias-state-warn-primary);}
.dsh-board-dot.offPeak{background:var(--dsw-alias-state-success-primary);}
.dsh-board-label{line-height:1;}
.dsh-board-panel{position:fixed;width:344px;max-height:72vh;overflow:auto;box-sizing:border-box;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;box-shadow:0 10px 32px rgba(0,0,0,.22);padding:12px 14px;z-index:1000;color:var(--dsw-alias-label-primary);font-size:12px;line-height:1.55;pointer-events:auto;text-align:left;}
.dsh-board-head{display:flex;flex-direction:column;gap:2px;margin-bottom:10px;}
.dsh-board-title{font-size:13px;font-weight:600;}
.dsh-board-sub{color:var(--dsw-alias-label-secondary);}
.dsh-board-current{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);border-radius:8px;padding:8px 10px;margin-bottom:10px;display:flex;flex-direction:column;gap:2px;}
.dsh-board-phase{display:flex;align-items:center;gap:6px;font-weight:600;}
.dsh-board-weekend-badge{font-weight:400;font-size:11px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:0 6px;}
.dsh-board-price2{color:var(--dsw-alias-label-secondary);}
.dsh-board-next{color:var(--dsw-alias-label-secondary);margin-top:2px;}
.dsh-board-section{font-weight:600;margin:8px 0 4px;}
.dsh-board-row{display:flex;align-items:center;gap:8px;padding:3px 0;}
.dsh-board-row-time{flex:1;min-width:0;}
.dsh-board-row-price{color:var(--dsw-alias-label-secondary);white-space:nowrap;}
.dsh-board-foot{margin-top:10px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:11px;}
.dsh-board-unknown{padding:8px;color:var(--dsw-alias-state-warn-primary);}
\`

    const slots = ctx.get('slots')
    if (slots === undefined) return

    ctx.effect(() => styles.insert(CSS))

    // ---- 按钮与浮层面板分属两个 Slot，用闭包共享状态 ----
    const store = {
      snapshot: null,
      open: false,
      anchor: null,
      listeners: new Set(),
      patch(next) { Object.assign(this, next); this.listeners.forEach((fn) => fn()) },
      subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn) },
    }

    let closeTimer = null
    const clearClose = () => { if (closeTimer) { closeTimer(); closeTimer = null } }
    const scheduleClose = () => {
      clearClose()
      closeTimer = ctx.timeout(() => store.patch({ open: false, anchor: null }), 160)
    }

    const useStore = () => {
      const [, setTick] = React.useState(0)
      React.useEffect(() => store.subscribe(() => setTick((t) => t + 1)), [])
      return store
    }

    // ---- 峰谷阶段计算：按北京时间（Asia/Shanghai），与本地时区无关 ----
    const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    const toMinutes = (hhmm) => { const p = hhmm.split(':'); return Number(p[0]) * 60 + Number(p[1]) }
    const fmtMinutes = (mins) => {
      const m = ((mins % 1440) + 1440) % 1440
      const h = String(Math.floor(m / 60)).padStart(2, '0')
      const mm = String(m % 60).padStart(2, '0')
      return h + ':' + mm
    }
    const fmtYuan = (v) => v.toFixed(2).replace(/\.?0+$/, '')

    function beijingClock(date) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Shanghai',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(date)
      const val = (t) => { const p = parts.find((x) => x.type === t); return p ? p.value : '' }
      let hour = Number(val('hour'))
      if (hour === 24) hour = 0
      const wd = WEEKDAY_INDEX[val('weekday')]
      return { weekday: wd === undefined ? date.getDay() : wd, minutes: hour * 60 + Number(val('minute')) }
    }

    function phaseAt(date, schedule) {
      const { weekday, minutes } = beijingClock(date)
      if ((weekday === 0 || weekday === 6) && schedule.weekendAllOffPeak) return 'offPeak'
      const inPeak = schedule.weekdayPeakWindows.some((w) => {
        const s = toMinutes(w.start)
        const e = toMinutes(w.end)
        return minutes >= s && minutes < e
      })
      return inPeak ? 'peak' : 'offPeak'
    }

    function nextTransition(date, schedule) {
      const from = phaseAt(date, schedule)
      for (let i = 1; i <= 48 * 60; i += 1) {
        const d = new Date(date.getTime() + i * 60000)
        const p = phaseAt(d, schedule)
        if (p !== from) return { minutesFromNow: i, toPhase: p }
      }
      return null
    }

    function weekdayPeriods(schedule) {
      const periods = []
      let cursor = 0
      for (const w of schedule.weekdayPeakWindows) {
        const s = toMinutes(w.start)
        const e = toMinutes(w.end)
        if (s > cursor) periods.push({ phase: 'offPeak', start: cursor, end: s })
        periods.push({ phase: 'peak', start: s, end: e })
        cursor = e
      }
      if (cursor < 1440) periods.push({ phase: 'offPeak', start: cursor, end: 1440 })
      return periods
    }

    function displayRows(schedule) {
      return weekdayPeriods(schedule).map((p) => {
        if (p.phase === 'peak') return { phase: 'peak', time: fmtMinutes(p.start) + ' – ' + fmtMinutes(p.end) }
        if (p.start === 0) return { phase: 'offPeak', time: '00:00 – ' + fmtMinutes(p.end) + '（与昨日傍晚起连续）' }
        if (p.end === 1440) return { phase: 'offPeak', time: fmtMinutes(p.start) + ' – 24:00（与次日凌晨连续）' }
        return { phase: 'offPeak', time: fmtMinutes(p.start) + ' – ' + fmtMinutes(p.end) }
      })
    }

    const fmtCountdown = (min) => min < 60 ? '约 ' + min + ' 分钟后' : '约 ' + Math.floor(min / 60) + ' 小时 ' + (min % 60) + ' 分后'

    // ---- 渲染器注册表：kind -> 组件（扩展点：新增看板时在此登记渲染器）----
    const renderers = { pricing: (board, opts) => React.createElement(PricingBoardView, { board: board, now: opts.now, key: opts.key, meta: opts.meta }) }

    // ---- 组件 ----
    function PricingBoardView({ board, now, key, meta }) {
      const schedule = board.schedule
      const model = board.models[0]
      const date = new Date(now)
      const phase = phaseAt(date, schedule)
      const price = model.prices[phase]
      const next = nextTransition(date, schedule)
      const rows = displayRows(schedule)
      const isWeekend = beijingClock(date).weekday === 0 || beijingClock(date).weekday === 6
      const phaseLabel = phase === 'peak' ? '高峰时段' : '低谷时段'
      const el = React.createElement

      const priceCells = (p) => {
        const cells = [el('span', { className: 'dsh-board-row-price' }, '输出 ¥' + fmtYuan(p.output))]
        if (p.inputCacheHit !== undefined) cells.push(el('span', { className: 'dsh-board-row-price' }, '缓存输入 ¥' + fmtYuan(p.inputCacheHit)))
        return cells
      }

      const rowEls = rows.map((r) => el('div', { className: 'dsh-board-row', key: r.time },
        el('span', { className: 'dsh-board-dot ' + r.phase }),
        el('span', { className: 'dsh-board-row-time' }, r.time),
        ...priceCells(model.prices[r.phase]),
      ))

      const nextEl = next
        ? el('div', { className: 'dsh-board-next' }, '下次切换：' + fmtCountdown(next.minutesFromNow) + ' → ' + (next.toPhase === 'peak' ? '高峰' : '低谷'))
        : null
      const weekendBadge = isWeekend ? el('span', { className: 'dsh-board-weekend-badge' }, '周末统一低谷价') : null
      const weekendRow = schedule.weekendAllOffPeak
        ? el('div', { className: 'dsh-board-row' },
            el('span', { className: 'dsh-board-dot offPeak' }),
            el('span', { className: 'dsh-board-row-time' }, '周末 00:00 – 24:00'),
            el('span', { className: 'dsh-board-row-price' }, '周六 / 周日 全天低谷价'),
          )
        : null

      return el('div', { className: 'dsh-board-body', key },
        el('div', { className: 'dsh-board-head' },
          el('div', { className: 'dsh-board-title' }, board.title),
          el('div', { className: 'dsh-board-sub' }, model.name + ' · 单位 ' + model.unit),
        ),
        el('div', { className: 'dsh-board-current' },
          el('div', { className: 'dsh-board-phase' },
            el('span', { className: 'dsh-board-dot ' + phase }),
            el('span', null, '当前：' + phaseLabel),
            weekendBadge,
          ),
          el('div', { className: 'dsh-board-price' }, '输出 ¥' + fmtYuan(price.output) + ' / 百万 tokens'),
          price.inputCacheHit !== undefined ? el('div', { className: 'dsh-board-price2' }, '缓存命中输入 ¥' + fmtYuan(price.inputCacheHit)) : null,
          nextEl,
        ),
        el('div', { className: 'dsh-board-section' }, '全部定价时段（工作日 · ' + schedule.timezone + '）'),
        ...rowEls,
        weekendRow,
        el('div', { className: 'dsh-board-foot' },
          '低谷价为高峰价的 ' + Math.round(schedule.offPeakFactor * 100) + '% · 数据内置，' + (meta ? meta.updatedAt : '') + ' 生效（北京时间）· 来源：' + (meta ? meta.source : ''),
        ),
      )
    }

    function BoardButton({ wide }) {
      const store2 = useStore()
      const btnRef = React.useRef(null)
      const [now, setNow] = React.useState(Date.now())
      const el = React.createElement

      React.useEffect(() => {
        let alive = true
        let attempts = 0
        let retryTimer = null
        const tryFetch = () => {
          host.call('board:snapshot').then((data) => {
            if (!alive) return
            if (data && data.boards) { store.patch({ snapshot: data }); return }
            if (attempts < 5) { attempts += 1; retryTimer = ctx.timeout(tryFetch, 1500) }
          }).catch((err) => {
            console.error('模型看板: 拉取快照失败', err)
            if (alive && attempts < 5) { attempts += 1; retryTimer = ctx.timeout(tryFetch, 1500) }
          })
        }
        tryFetch()
        return () => { alive = false; if (retryTimer) retryTimer() }
      }, [])

      React.useEffect(() => ctx.interval(() => setNow(Date.now()), 30000), [])

      const snap = store2.snapshot
      const pricing = snap ? snap.boards.find((b) => b.kind === 'pricing') : null
      const model = pricing ? pricing.models[0] : null
      const phase = model ? phaseAt(new Date(now), pricing.schedule) : null

      const onEnter = () => {
        const node = btnRef.current
        if (!node) return
        const r = node.getBoundingClientRect()
        clearClose()
        store.patch({ open: true, anchor: { left: r.left, top: r.top, width: r.width, height: r.height } })
      }
      const onLeave = () => scheduleClose()

      const children = []
      if (model && phase) {
        children.push(el('span', { className: 'dsh-board-dot ' + phase }))
        if (wide) {
          const price = model.prices[phase]
          children.push(el('span', { className: 'dsh-board-label' }, (phase === 'peak' ? '高峰' : '低谷') + ' ¥' + fmtYuan(price.output)))
        }
      }
      if (children.length === 0 && wide) children.push(el('span', { className: 'dsh-board-label' }, '看板'))

      const aria = model && phase
        ? '模型看板：当前' + (phase === 'peak' ? '高峰' : '低谷') + '时段，输出 ¥' + fmtYuan(model.prices[phase].output) + '/百万tokens'
        : '模型看板'

      return el('div', {
        ref: btnRef,
        className: 'dsh-board-cell' + (store2.open ? ' open' : ''),
        role: 'button',
        tabIndex: 0,
        'aria-label': aria,
        onMouseEnter: onEnter,
        onMouseLeave: onLeave,
        onFocus: onEnter,
        onBlur: onLeave,
      }, ...children)
    }

    function BoardPanel() {
      const store2 = useStore()
      const [now, setNow] = React.useState(Date.now())
      const el = React.createElement

      React.useEffect(() => ctx.interval(() => setNow(Date.now()), 30000), [])

      if (!store2.open || !store2.anchor) return null
      const snap = store2.snapshot
      if (!snap || !snap.boards) return null

      const vw = window.innerWidth
      const center = store2.anchor.left + store2.anchor.width / 2
      const left = Math.max(175, Math.min(center, vw - 175))
      const style = {
        position: 'fixed',
        left: left + 'px',
        bottom: (window.innerHeight - store2.anchor.top + 10) + 'px',
        transform: 'translateX(-50%)',
      }

      const cards = snap.boards.map((board) => {
        const render = renderers[board.kind]
        if (!render) {
          return el('div', { className: 'dsh-board-unknown', key: board.id }, board.title + '：未注册渲染器（kind=' + board.kind + '）')
        }
        return render(board, { now: now, key: board.id, meta: snap })
      })

      return el('div', { className: 'dsh-board-panel', style, onMouseEnter: clearClose, onMouseLeave: scheduleClose }, ...cards)
    }

    // ---- 挂载：设置按钮旁的附加操作位 + 框架级浮层 ----
    slots.inject('sidebar.footer.action', () => slots.register(
      { name: 'sidebar.footer.action', id: 'deepseek-model-board' },
      (props) => React.createElement(BoardButton, { wide: Boolean(props.wide) }),
    ))
    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'deepseek-model-board-panel' },
      () => React.createElement(BoardPanel),
    ))

    console.log('模型看板插件客户端已启动')
  },
}`

module.exports = { hostBody, clientBody }
