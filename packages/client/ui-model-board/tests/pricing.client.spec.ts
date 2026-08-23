import { describe, expect, it } from 'vitest'
import {
  SCHEDULE, displayRows, fmtCountdown, fmtMinutes, fmtYuan, nextTransition, phaseAt, toMinutes,
} from '../src/client/pricing.ts'

describe('formatting helpers', () => {
  it('converts HH:MM to minutes and back', () => {
    expect(toMinutes('09:00')).toBe(540)
    expect(toMinutes('18:00')).toBe(1080)
    expect(fmtMinutes(540)).toBe('09:00')
    expect(fmtMinutes(1080)).toBe('18:00')
  })

  it('formats yuan with trailing zeros stripped', () => {
    expect(fmtYuan(27)).toBe('27')
    expect(fmtYuan(13.5)).toBe('13.5')
    expect(fmtYuan(0.3)).toBe('0.3')
    expect(fmtYuan(0.15)).toBe('0.15')
  })

  it('formats a countdown under and over an hour', () => {
    expect(fmtCountdown(45)).toBe('约 45 分钟后')
    expect(fmtCountdown(90)).toBe('约 1 小时 30 分后')
  })
})

describe('phaseAt', () => {
  // 2026-08-24 is a Monday; Beijing = UTC+8.
  it('is peak inside a weekday peak window', () => {
    expect(phaseAt(new Date('2026-08-24T02:00:00Z'), SCHEDULE)).toBe('peak') // 10:00 Beijing
  })

  it('is off-peak in the weekday midday gap', () => {
    expect(phaseAt(new Date('2026-08-24T05:00:00Z'), SCHEDULE)).toBe('offPeak') // 13:00 Beijing
  })

  it('is off-peak all weekend', () => {
    expect(phaseAt(new Date('2026-08-23T02:00:00Z'), SCHEDULE)).toBe('offPeak') // Sunday 10:00 Beijing
  })
})

describe('nextTransition', () => {
  it('finds the next peak switch from the midday off-peak gap', () => {
    const next = nextTransition(new Date('2026-08-24T05:00:00Z'), SCHEDULE) // 13:00 Beijing
    expect(next).toEqual({ minutesFromNow: 60, toPhase: 'peak' })
  })
})

describe('displayRows', () => {
  it('projects the weekday schedule with the overnight wrap labelled', () => {
    expect(displayRows(SCHEDULE)).toEqual([
      { phase: 'offPeak', time: '00:00 – 09:00（与昨日傍晚起连续）' },
      { phase: 'peak', time: '09:00 – 12:00' },
      { phase: 'offPeak', time: '12:00 – 14:00' },
      { phase: 'peak', time: '14:00 – 18:00' },
      { phase: 'offPeak', time: '18:00 – 24:00（与次日凌晨连续）' },
    ])
  })
})
