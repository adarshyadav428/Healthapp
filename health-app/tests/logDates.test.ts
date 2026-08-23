import { describe, it, expect } from 'vitest'
import { shiftDateStr, logHref, decideSwipe } from '../lib/logDates'
import { istDateStr } from '../lib/dateUtils'

describe('the diary day is IST, not UTC', () => {
  // 20:00 UTC on the 22nd is 01:30 IST on the 23rd — inside the 00:00–05:30
  // IST window, which is the late-dinner logging slot.
  //
  // logDates used to define its own `todayUtcStr`, so in this window it called
  // it the 22nd while app/log/page.tsx (istDateStr) called it the 23rd. The
  // Today pill therefore rendered on the day that already was today, and the
  // next-day chevron unlocked into a date the server clamped straight back.
  const lateNightIst = new Date('2026-08-22T20:00:00Z')

  it('treats 01:30 IST as the new day', () => {
    expect(istDateStr(lateNightIst)).toBe('2026-08-23')
  })

  it('gives that IST day the canonical bare /log URL', () => {
    const today = istDateStr(lateNightIst)
    expect(logHref(today, today)).toBe('/log')
    expect(logHref(shiftDateStr(today, -1), today)).toBe('/log?date=2026-08-22')
  })
})

describe('shiftDateStr', () => {
  it('shifts across month and year boundaries', () => {
    expect(shiftDateStr('2026-07-01', -1)).toBe('2026-06-30')
    expect(shiftDateStr('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDateStr('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('logHref', () => {
  it('gives today the canonical bare URL', () => {
    expect(logHref('2026-07-16', '2026-07-16')).toBe('/log')
    expect(logHref('2026-07-15', '2026-07-16')).toBe('/log?date=2026-07-15')
  })
})

describe('decideSwipe', () => {
  it('classifies deliberate horizontal swipes', () => {
    expect(decideSwipe(-120, 10)).toBe('next')
    expect(decideSwipe(120, -10)).toBe('prev')
  })

  it('ignores short movements', () => {
    expect(decideSwipe(-40, 0)).toBe(null)
  })

  it('ignores diagonal/vertical gestures (page scrolling)', () => {
    expect(decideSwipe(-80, 60)).toBe(null)
    expect(decideSwipe(80, -50)).toBe(null)
  })
})
