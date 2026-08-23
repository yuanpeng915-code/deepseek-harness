/** Model pricing board: footer button plus overlay popover (shared hover store). */

import { useEffect, useRef, useState } from 'react'
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import {
  SCHEDULE, MODELS, UPDATED_AT, SOURCE,
  beijingClock, displayRows, fmtCountdown, fmtYuan, nextTransition, phaseAt,
} from './pricing.ts'
import css from './ModelBoard.module.css'

/** Hover anchor measured from the trigger button. */
interface Anchor {
  readonly left: number
  readonly top: number
  readonly width: number
}

type BoardState = {
  open: boolean
  anchor: Anchor | null
  /** window.setTimeout id of a pending close, so the panel can cancel it. */
  closeTimerId: number | null
}

type BoardActions = {
  open: (d: BoardState, anchor: Anchor) => void
  close: (d: BoardState) => void
  armClose: (d: BoardState, timerId: number) => void
}

/** Shared hover state between the footer button and the overlay panel. */
export function createBoardStore(): EngineStoreHandle<BoardState, BoardActions> {
  return defineStore({
    init: (): BoardState => ({ open: false, anchor: null, closeTimerId: null }),
    actions: {
      open: (d, anchor) => { d.open = true; d.anchor = anchor; d.closeTimerId = null },
      close: (d) => { d.open = false; d.anchor = null; d.closeTimerId = null },
      armClose: (d, timerId) => { d.closeTimerId = timerId },
    },
  })
}

type BoardStore = ReturnType<typeof createBoardStore>
type ButtonProps = PropsRuntime<'sidebar.footer.action'> & PropsStore<BoardStore>
type PanelProps = PropsRuntime<'shell.overlay'> & PropsStore<BoardStore>

const CLOSE_DELAY_MS = 160

/** Footer action: current phase dot + output price (dot-only in the rail). */
export function ModelBoardButton({ wide, useStore, actions }: ButtonProps) {
  const open = useStore(s => s.open)
  const [now, setNow] = useState(() => Date.now())
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = window.setInterval(() => { setNow(Date.now()) }, 30000)
    return () => { window.clearInterval(id) }
  }, [])

  const model = MODELS[0]
  const phase = phaseAt(new Date(now), SCHEDULE)
  const price = model.prices[phase]

  const onEnter = (): void => {
    const node = rootRef.current
    if (node === null) return
    const r = node.getBoundingClientRect()
    actions.open({ left: r.left, top: r.top, width: r.width })
  }
  const onLeave = (): void => {
    const timerId = window.setTimeout(() => { actions.close() }, CLOSE_DELAY_MS)
    actions.armClose(timerId)
  }

  const label = phase === 'peak' ? '高峰' : '低谷'

  return (
    <div
      ref={rootRef}
      className={open ? `${css.cell} ${css.cellOpen}` : css.cell}
      role="button"
      tabIndex={0}
      aria-label={`模型看板：当前${label}时段，输出 ¥${fmtYuan(price.output)}/百万tokens`}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      <span className={phase === 'peak' ? `${css.dot} ${css.dotPeak}` : `${css.dot} ${css.dotOffPeak}`} />
      {wide ? <span className={css.label}>{label} ¥{fmtYuan(price.output)}</span> : null}
    </div>
  )
}

/** Overlay panel: current phase card plus the full weekday/weekend schedule. */
export function ModelBoardPanel({ useStore, actions }: PanelProps) {
  const open = useStore(s => s.open)
  const anchor = useStore(s => s.anchor)
  const closeTimerId = useStore(s => s.closeTimerId)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => { setNow(Date.now()) }, 30000)
    return () => { window.clearInterval(id) }
  }, [])

  if (!open || anchor === null) return null

  const model = MODELS[0]
  const date = new Date(now)
  const phase = phaseAt(date, SCHEDULE)
  const price = model.prices[phase]
  const next = nextTransition(date, SCHEDULE)
  const rows = displayRows(SCHEDULE)
  const isWeekend = beijingClock(date).weekday === 0 || beijingClock(date).weekday === 6
  const phaseLabel = phase === 'peak' ? '高峰时段' : '低谷时段'

  const vw = window.innerWidth
  const center = anchor.left + anchor.width / 2
  const left = Math.max(175, Math.min(center, vw - 175))
  const style = {
    left: `${left}px`,
    bottom: `${window.innerHeight - anchor.top + 10}px`,
    transform: 'translateX(-50%)',
  }

  const onEnter = (): void => {
    if (closeTimerId !== null) window.clearTimeout(closeTimerId)
    actions.open(anchor)
  }
  const onLeave = (): void => {
    const timerId = window.setTimeout(() => { actions.close() }, CLOSE_DELAY_MS)
    actions.armClose(timerId)
  }

  return (
    <div className={css.panel} style={style} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <div className={css.head}>
        <div className={css.title}>模型峰谷定价</div>
        <div className={css.sub}>{model.name} · 单位 {model.unit}</div>
      </div>
      <div className={css.current}>
        <div className={css.phase}>
          <span className={phase === 'peak' ? `${css.dot} ${css.dotPeak}` : `${css.dot} ${css.dotOffPeak}`} />
          <span>当前：{phaseLabel}</span>
          {isWeekend ? <span className={css.weekendBadge}>周末统一低谷价</span> : null}
        </div>
        <div className={css.price}>输出 ¥{fmtYuan(price.output)} / 百万 tokens</div>
        {price.inputCacheHit !== undefined ? <div className={css.price2}>缓存命中输入 ¥{fmtYuan(price.inputCacheHit)}</div> : null}
        {next !== null ? <div className={css.next}>下次切换：{fmtCountdown(next.minutesFromNow)} → {next.toPhase === 'peak' ? '高峰' : '低谷'}</div> : null}
      </div>
      <div className={css.section}>全部定价时段（工作日 · {SCHEDULE.timezone}）</div>
      {rows.map((r) => {
        const p = model.prices[r.phase]
        return (
          <div className={css.row} key={r.time}>
            <span className={r.phase === 'peak' ? `${css.dot} ${css.dotPeak}` : `${css.dot} ${css.dotOffPeak}`} />
            <span className={css.rowTime}>{r.time}</span>
            <span className={css.rowPrice}>输出 ¥{fmtYuan(p.output)}</span>
            {p.inputCacheHit !== undefined ? <span className={css.rowPrice}>缓存输入 ¥{fmtYuan(p.inputCacheHit)}</span> : null}
          </div>
        )
      })}
      {SCHEDULE.weekendAllOffPeak ? (
        <div className={css.row}>
          <span className={`${css.dot} ${css.dotOffPeak}`} />
          <span className={css.rowTime}>周末 00:00 – 24:00</span>
          <span className={css.rowPrice}>周六 / 周日 全天低谷价</span>
        </div>
      ) : null}
      <div className={css.foot}>
        低谷价为高峰价的 {Math.round(SCHEDULE.offPeakFactor * 100)}% · 数据内置，{UPDATED_AT} 生效（北京时间）· 来源：{SOURCE}
      </div>
    </div>
  )
}
