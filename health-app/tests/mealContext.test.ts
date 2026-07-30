import { describe, it, expect } from 'vitest'
import {
  contextInsight, contextInsightLine, homeCookedShare, isMealContext,
  MIN_DAYS_PER_SIDE, MIN_KCAL_DIFFERENCE, MEAL_CONTEXTS,
} from '../lib/mealContext'

const day = (n: number) => `2026-08-${String(n).padStart(2, '0')}T06:30:00Z`

/** n days at `kcal`, tagged with `context` (or untagged). */
function days(from: number, n: number, kcal: number, context?: string) {
  return Array.from({ length: n }, (_, i) => ({ logged_at: day(from + i), kcal, context }))
}

describe('isMealContext', () => {
  it('accepts the four contexts and nothing else', () => {
    for (const c of MEAL_CONTEXTS) expect(isMealContext(c)).toBe(true)
    for (const c of ['gym', '', null, undefined, 7]) expect(isMealContext(c)).toBe(false)
  })
})

describe('contextInsight — when it refuses to speak', () => {
  it('says nothing without enough days on each side', () => {
    // 3 restaurant days vs 10 — one short of the floor.
    const logs = [...days(1, 3, 2600, 'restaurant'), ...days(10, 10, 1800)]
    expect(contextInsight(logs)).toBeNull()
    expect(MIN_DAYS_PER_SIDE).toBeGreaterThan(1)
  })

  it('says nothing when the gap is noise rather than a finding', () => {
    const logs = [...days(1, 8, 1900, 'restaurant'), ...days(10, 8, 1850)]
    expect(contextInsight(logs)).toBeNull()
    expect(MIN_KCAL_DIFFERENCE).toBeGreaterThan(0)
  })

  it('says nothing when nothing is tagged', () => {
    expect(contextInsight(days(1, 20, 2000))).toBeNull()
  })

  it('says nothing about an empty history', () => {
    expect(contextInsight([])).toBeNull()
  })
})

describe('contextInsight — what it finds', () => {
  it('reports the effect of eating out', () => {
    const logs = [...days(1, 6, 2600, 'restaurant'), ...days(10, 12, 1800)]
    const insight = contextInsight(logs)!
    expect(insight.context).toBe('restaurant')
    expect(insight.withAvgKcal).toBe(2600)
    expect(insight.withoutAvgKcal).toBe(1800)
    expect(insight.differenceKcal).toBe(800)
    expect(insight.daysWith).toBe(6)
  })

  it('compares whole days, not meals', () => {
    // One restaurant meal plus a big rest-of-day — the day is what counts.
    const logs = [
      ...Array.from({ length: 6 }, (_, i) => ({ logged_at: day(1 + i), kcal: 700, context: 'restaurant' })),
      ...Array.from({ length: 6 }, (_, i) => ({ logged_at: day(1 + i), kcal: 1900, context: null })),
      ...days(10, 8, 1800),
    ]
    const insight = contextInsight(logs)!
    expect(insight.withAvgKcal).toBe(2600)
  })

  it('reports a negative effect too, not just the flattering direction', () => {
    const logs = [...days(1, 6, 1400, 'home'), ...days(10, 8, 2200)]
    const insight = contextInsight(logs)!
    expect(insight.context).toBe('home')
    expect(insight.differenceKcal).toBe(-800)
  })

  it('picks the largest effect — one clear sentence beats four hedged ones', () => {
    const logs = [
      ...days(1, 6, 2800, 'restaurant'),
      ...days(10, 6, 2100, 'office'),
      ...days(20, 8, 1800),
    ]
    expect(contextInsight(logs)!.context).toBe('restaurant')
  })
})

describe('contextInsightLine', () => {
  it('says more plainly', () => {
    const logs = [...days(1, 6, 2600, 'restaurant'), ...days(10, 12, 1800)]
    expect(contextInsightLine(contextInsight(logs)))
      .toBe('Days with a eating out meal average 800 kcal more than the rest.')
  })

  it('says less when that is the truth', () => {
    const logs = [...days(1, 6, 1400, 'home'), ...days(10, 8, 2200)]
    expect(contextInsightLine(contextInsight(logs))).toMatch(/800 kcal less/)
  })

  it('says nothing when there is no insight', () => {
    expect(contextInsightLine(null)).toBeNull()
  })
})

describe('homeCookedShare', () => {
  it('is the share of TAGGED meals, ignoring untagged ones', () => {
    const logs = [
      { logged_at: day(1), kcal: 500, context: 'home' },
      { logged_at: day(1), kcal: 500, context: 'home' },
      { logged_at: day(2), kcal: 500, context: 'restaurant' },
      { logged_at: day(2), kcal: 500, context: null },
    ]
    expect(homeCookedShare(logs)).toBeCloseTo(2 / 3)
  })

  it('is null when nothing is tagged — not zero, which would be a lie', () => {
    expect(homeCookedShare([{ logged_at: day(1), kcal: 500 }])).toBeNull()
    expect(homeCookedShare([])).toBeNull()
  })

  it('is 1 when every tagged meal was home-cooked', () => {
    expect(homeCookedShare([{ logged_at: day(1), kcal: 500, context: 'home' }])).toBe(1)
  })
})
