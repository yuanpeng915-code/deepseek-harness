/** Pure model-pricing schedule, phase computation, and formatting helpers. */

/** A time window on the 24-hour Beijing clock. */
export interface TimeWindow {
  readonly start: string
  readonly end: string
}

/** Peak/off-peak schedule, Beijing time (Asia/Shanghai). */
export interface PricingSchedule {
  readonly timezone: string
  readonly weekdayPeakWindows: readonly TimeWindow[]
  readonly weekendAllOffPeak: boolean
  readonly offPeakFactor: number
}

/** Per-phase prices, unit yuan per million tokens. */
export interface PhasePrices {
  readonly inputCacheHit?: number
  readonly output: number
}

/** One model's published price table. */
export interface ModelPricing {
  readonly id: string
  readonly name: string
  readonly unit: string
  readonly prices: {
    readonly peak: PhasePrices
    readonly offPeak: PhasePrices
  }
}

export type Phase = 'peak' | 'offPeak'

/** The embedded pricing board (DeepSeek official schedule, 2026-08-23). */
export const SCHEDULE: PricingSchedule = {
  timezone: 'Asia/Shanghai',
  weekdayPeakWindows: [
    { start: '09:00', end: '12:00' },
    { start: '14:00', end: '18:00' },
  ],
  weekendAllOffPeak: true,
  offPeakFactor: 0.5,
}

export const MODELS: readonly [ModelPricing, ...ModelPricing[]] = [
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek-V4-Pro',
    unit: '元 / 百万 tokens',
    prices: {
      peak: { inputCacheHit: 0.3, output: 27.0 },
      offPeak: { inputCacheHit: 0.15, output: 13.5 },
    },
  },
]

export const UPDATED_AT = '2026-08-23'
export const SOURCE = 'DeepSeek 官方计费公告'

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export function fmtMinutes(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440
  const h = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return `${h}:${mm}`
}

export function fmtYuan(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '')
}

/** Read the weekday and minutes-of-day on the Beijing clock, independent of local timezone. */
export function beijingClock(date: Date): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const val = (t: Intl.DateTimeFormatPartTypes): string => parts.find(p => p.type === t)?.value ?? ''
  let hour = Number(val('hour'))
  if (hour === 24) hour = 0
  const weekday = WEEKDAY_INDEX[val('weekday')] ?? date.getDay()
  return { weekday, minutes: hour * 60 + Number(val('minute')) }
}

export function phaseAt(date: Date, schedule: PricingSchedule): Phase {
  const { weekday, minutes } = beijingClock(date)
  if ((weekday === 0 || weekday === 6) && schedule.weekendAllOffPeak) return 'offPeak'
  const inPeak = schedule.weekdayPeakWindows.some((w) => {
    const s = toMinutes(w.start)
    const e = toMinutes(w.end)
    return minutes >= s && minutes < e
  })
  return inPeak ? 'peak' : 'offPeak'
}

export function nextTransition(date: Date, schedule: PricingSchedule): { minutesFromNow: number; toPhase: Phase } | null {
  const from = phaseAt(date, schedule)
  for (let i = 1; i <= 48 * 60; i += 1) {
    const d = new Date(date.getTime() + i * 60000)
    const p = phaseAt(d, schedule)
    if (p !== from) return { minutesFromNow: i, toPhase: p }
  }
  return null
}

interface WeekdayPeriod { phase: Phase; start: number; end: number }

export function weekdayPeriods(schedule: PricingSchedule): WeekdayPeriod[] {
  const periods: WeekdayPeriod[] = []
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

export interface DisplayRow { phase: Phase; time: string }

export function displayRows(schedule: PricingSchedule): DisplayRow[] {
  return weekdayPeriods(schedule).map((p) => {
    if (p.phase === 'peak') return { phase: 'peak', time: `${fmtMinutes(p.start)} – ${fmtMinutes(p.end)}` }
    if (p.start === 0) return { phase: 'offPeak', time: `00:00 – ${fmtMinutes(p.end)}（与昨日傍晚起连续）` }
    if (p.end === 1440) return { phase: 'offPeak', time: `${fmtMinutes(p.start)} – 24:00（与次日凌晨连续）` }
    return { phase: 'offPeak', time: `${fmtMinutes(p.start)} – ${fmtMinutes(p.end)}` }
  })
}

export function fmtCountdown(min: number): string {
  return min < 60 ? `约 ${min} 分钟后` : `约 ${Math.floor(min / 60)} 小时 ${min % 60} 分后`
}
