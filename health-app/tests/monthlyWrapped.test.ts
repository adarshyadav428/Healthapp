import { describe, it, expect } from 'vitest'
import {
  isFirstSundayOfMonth, previousMonthStart, monthLabel, istDayStartInstant,
  buildMonthlyWrappedCards, MIN_DAYS_FOR_WRAP, isMonthlyWrapWindow,
} from '../lib/monthlyWrapped'
import type { WrappedStats } from '../lib/wrappedStats'

// Noon IST keeps fixtures unambiguously inside one IST day.
const noonIst = (day: string) => new Date(`${day}T06:30:00Z`)

describe('isFirstSundayOfMonth', () => {
  it('fires on the first Sunday', () => {
    // 2026-08-02 is a Sunday, the first of August.
    expect(isFirstSundayOfMonth(noonIst('2026-08-02'))).toBe(true)
  })

  it('does not fire on later Sundays', () => {
    expect(isFirstSundayOfMonth(noonIst('2026-08-09'))).toBe(false)
    expect(isFirstSundayOfMonth(noonIst('2026-08-30'))).toBe(false)
  })

  it('does not fire on a non-Sunday early in the month', () => {
    expect(isFirstSundayOfMonth(noonIst('2026-08-03'))).toBe(false)
    expect(isFirstSundayOfMonth(noonIst('2026-08-01'))).toBe(false)
  })

  it('fires exactly once a month, whichever day the 1st falls on', () => {
    // Walk a whole year of Sundays; each month must claim exactly one.
    const hits = new Map<string, number>()
    for (let d = Date.parse('2026-01-01T06:30:00Z'); d < Date.parse('2027-01-01T06:30:00Z'); d += 86400000) {
      const date = new Date(d)
      if (!isFirstSundayOfMonth(date)) continue
      const key = date.toISOString().slice(0, 7)
      hits.set(key, (hits.get(key) ?? 0) + 1)
    }
    expect(hits.size).toBe(12)
    expect([...hits.values()].every((n) => n === 1)).toBe(true)
  })

  it('reads the day in IST, not UTC', () => {
    // 2026-08-01T19:00:00Z is 00:30 IST on Sunday 2 Aug.
    expect(isFirstSundayOfMonth(new Date('2026-08-01T19:00:00Z'))).toBe(true)
  })
})

describe('isMonthlyWrapWindow', () => {
  it('covers the first two Sundays, so a timed-out run gets a second chance', () => {
    expect(isMonthlyWrapWindow(noonIst('2026-08-02'))).toBe(true)
    expect(isMonthlyWrapWindow(noonIst('2026-08-09'))).toBe(true)
  })

  it('closes after the fortnight', () => {
    expect(isMonthlyWrapWindow(noonIst('2026-08-16'))).toBe(false)
    expect(isMonthlyWrapWindow(noonIst('2026-08-23'))).toBe(false)
  })

  it('is Sundays only — the host cron does not run on other days', () => {
    expect(isMonthlyWrapWindow(noonIst('2026-08-03'))).toBe(false)
  })

  it('still names the same month on both Sundays, so the mop-up wraps the right one', () => {
    expect(previousMonthStart(noonIst('2026-08-02')))
      .toBe(previousMonthStart(noonIst('2026-08-09')))
  })
})

describe('previousMonthStart', () => {
  it('wraps the month that just ended', () => {
    expect(previousMonthStart(noonIst('2026-08-02'))).toBe('2026-07-01')
  })

  it('crosses the year boundary', () => {
    expect(previousMonthStart(noonIst('2026-01-04'))).toBe('2025-12-01')
  })
})

describe('monthLabel / istDayStartInstant', () => {
  it('reads as a human month', () => {
    expect(monthLabel('2026-07-01')).toBe('July 2026')
    expect(monthLabel('2025-12-01')).toBe('December 2025')
  })

  it('converts an IST day key to the right instant', () => {
    // IST midnight is 18:30 UTC the previous day.
    expect(istDayStartInstant('2026-07-01')).toBe('2026-06-30T18:30:00.000Z')
  })
})

const base: WrappedStats = {
  daysLogged: 24, totalMeals: 310, avgKcal: 1790,
  topFood: { name: 'Rajma Chawal', count: 19 },
  longestStreakDays: 11, currentStreakDays: 4, proteinDaysHit: 15,
  weightDeltaKg: -1.8,
  bestDay: { date: '2026-07-14', kcal: 1720, proteinG: 141 },
  aiScans: 30, hasStory: true,
}

const build = (over: Partial<Parameters<typeof buildMonthlyWrappedCards>[0]> = {}) =>
  buildMonthlyWrappedCards({ stats: base, monthStart: '2026-07-01', message: 'Strong month.', isPro: true, ...over })

describe('buildMonthlyWrappedCards', () => {
  it('opens on the month and closes on sharing', () => {
    const cards = build()
    expect(cards[0].id).toBe('wrap-hello')
    expect(cards[0].eyebrow).toBe('July 2026')
    expect(cards.at(-1)!.id).toBe('wrap-go')
  })

  it('gives free users an honest wall, not a degraded story', () => {
    const ids = build({ isPro: false }).map((c) => c.id)
    expect(ids).toEqual(['wrap-hello', 'wrap-days', 'wrap-locked'])
  })

  it('gives Pro the full set', () => {
    const ids = build().map((c) => c.id)
    expect(ids).toContain('wrap-top-food')
    expect(ids).toContain('wrap-best-day')
    expect(ids).toContain('wrap-streak')
    expect(ids).toContain('wrap-weight')
  })

  it('reports a GAIN too — unlike the welcome sequence', () => {
    // A monthly review that only ever reports good news can't be trusted the
    // next time it reports good news.
    const card = build({ stats: { ...base, weightDeltaKg: 1.2 } }).find((c) => c.id === 'wrap-weight')!
    expect(card.value).toBe('1.2 kg')
    expect(card.label).toBe('up this month')
    expect(card.body).toMatch(/happen/i)
  })

  it('stays quiet about weight noise and missing weigh-ins', () => {
    for (const delta of [null, 0, 0.05, -0.05]) {
      const ids = build({ stats: { ...base, weightDeltaKg: delta } }).map((c) => c.id)
      expect(ids).not.toContain('wrap-weight')
    }
  })

  it('drops stats that did not earn a card', () => {
    const thin: WrappedStats = {
      ...base, totalMeals: 4, topFood: { name: 'Idli', count: 1 },
      longestStreakDays: 1, bestDay: null, weightDeltaKg: null,
    }
    const ids = build({ stats: thin }).map((c) => c.id)
    expect(ids).toEqual(['wrap-hello', 'wrap-days', 'wrap-go'])
  })

  it('stays serializable and uniquely keyed', () => {
    const cards = build()
    expect(JSON.parse(JSON.stringify(cards))).toEqual(cards)
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length)
  })

  it('sets a floor so an empty month is never wrapped', () => {
    expect(MIN_DAYS_FOR_WRAP).toBeGreaterThan(0)
  })
})
