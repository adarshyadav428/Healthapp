import { describe, it, expect } from 'vitest'
import { computeWrappedStats, type WrappedInput } from '../lib/wrappedStats'
import type { Food, FoodLog } from '../types/index'

// Noon IST keeps every fixture safely inside one IST day, so a test never fails
// for a timezone reason it didn't mean to exercise.
const noonIst = (day: string) => `${day}T06:30:00.000Z`

function food(name: string): Food {
  return { id: `f-${name}`, name } as unknown as Food
}

function log(day: string, over: Partial<FoodLog> = {}): FoodLog {
  return {
    id: `l-${day}-${Math.round((over.kcal ?? 0) + (over.protein_g ?? 0))}-${over.food?.name ?? ''}`,
    user_id: 'u1',
    food_id: null,
    food: null,
    meal: 'lunch',
    servings: 1,
    grams: 100,
    kcal: 500,
    protein_g: 20,
    carbs_g: 50,
    fat_g: 10,
    logged_at: noonIst(day),
    ...over,
  } as FoodLog
}

const base: WrappedInput = { logs: [], weighIns: [], proteinTargetG: 100 }

describe('computeWrappedStats — empty and thin history', () => {
  it('returns a zeroed, story-less result for a brand-new account', () => {
    const s = computeWrappedStats(base)
    expect(s.daysLogged).toBe(0)
    expect(s.totalMeals).toBe(0)
    expect(s.avgKcal).toBe(0)
    expect(s.topFood).toBeNull()
    expect(s.bestDay).toBeNull()
    expect(s.weightDeltaKg).toBeNull()
    expect(s.hasStory).toBe(false)
  })

  it('never divides by zero when nothing was logged', () => {
    expect(computeWrappedStats(base).avgKcal).toBe(0)
    expect(Number.isNaN(computeWrappedStats(base).avgKcal)).toBe(false)
  })

  it('has a story after a single logged day — the day-one upgrader', () => {
    // This is the case that decides whether /welcome shows real stats or its
    // fallback variant, so it gets its own test rather than riding along.
    const s = computeWrappedStats({ ...base, logs: [log('2026-07-20')] })
    expect(s.daysLogged).toBe(1)
    expect(s.hasStory).toBe(true)
    expect(s.avgKcal).toBe(500)
  })

  it('reports a single weigh-in as no change, not a fake zero', () => {
    const s = computeWrappedStats({
      ...base,
      weighIns: [{ weight_kg: 80, measured_at: noonIst('2026-07-20') }],
    })
    expect(s.weightDeltaKg).toBeNull()
  })
})

describe('computeWrappedStats — counting', () => {
  it('counts distinct IST days, not rows', () => {
    const s = computeWrappedStats({
      ...base,
      logs: [log('2026-07-20'), log('2026-07-20', { kcal: 300 }), log('2026-07-21')],
    })
    expect(s.daysLogged).toBe(2)
    expect(s.totalMeals).toBe(3)
  })

  it('averages over logged days only, so a gap does not drag the mean down', () => {
    // Two days totalling 500 and 900 — mean 700, not 1400/3 across a skipped day.
    const s = computeWrappedStats({
      ...base,
      logs: [log('2026-07-20'), log('2026-07-22', { kcal: 900 })],
    })
    expect(s.avgKcal).toBe(700)
  })

  it('counts protein days against the target, and none without one', () => {
    const logs = [
      log('2026-07-20', { protein_g: 120 }), // hit
      log('2026-07-21', { protein_g: 60 }),  // miss
      log('2026-07-22', { protein_g: 100 }), // exactly on target counts
    ]
    expect(computeWrappedStats({ ...base, logs }).proteinDaysHit).toBe(2)
    expect(computeWrappedStats({ ...base, logs, proteinTargetG: null }).proteinDaysHit).toBe(0)
    expect(computeWrappedStats({ ...base, logs, proteinTargetG: 0 }).proteinDaysHit).toBe(0)
  })

  it('sums protein across a day before judging it', () => {
    // Three modest meals clear a 100 g target together but none does alone.
    const s = computeWrappedStats({
      ...base,
      logs: [
        log('2026-07-20', { protein_g: 40 }),
        log('2026-07-20', { protein_g: 35 }),
        log('2026-07-20', { protein_g: 30 }),
      ],
    })
    expect(s.proteinDaysHit).toBe(1)
  })
})

describe('computeWrappedStats — top dish', () => {
  it('picks the most-logged dish by name', () => {
    const s = computeWrappedStats({
      ...base,
      logs: [
        log('2026-07-20', { food: food('Dal Tadka') }),
        log('2026-07-21', { food: food('Dal Tadka') }),
        log('2026-07-22', { food: food('Idli') }),
      ],
    })
    expect(s.topFood).toEqual({ name: 'Dal Tadka', count: 2 })
  })

  it('counts by name so the same dish from different sources is one dish', () => {
    // The same food can arrive as an IFCT row, a curated estimate, or an Open
    // Food Facts row with different ids — the user thinks of those as one food.
    const s = computeWrappedStats({
      ...base,
      logs: [
        log('2026-07-20', { food: { ...food('Poha'), id: 'ifct-1' } as Food }),
        log('2026-07-21', { food: { ...food('Poha'), id: 'off-9' } as Food }),
        log('2026-07-22', { food: food('Upma') }),
      ],
    })
    expect(s.topFood).toEqual({ name: 'Poha', count: 2 })
  })

  it('breaks ties alphabetically rather than by insertion order', () => {
    const forwards = computeWrappedStats({
      ...base,
      logs: [log('2026-07-20', { food: food('Rajma') }), log('2026-07-21', { food: food('Chole') })],
    })
    const backwards = computeWrappedStats({
      ...base,
      logs: [log('2026-07-20', { food: food('Chole') }), log('2026-07-21', { food: food('Rajma') })],
    })
    expect(forwards.topFood).toEqual({ name: 'Chole', count: 1 })
    expect(backwards.topFood).toEqual(forwards.topFood)
  })

  it('ignores logs with no food name (quick-add rows)', () => {
    const s = computeWrappedStats({
      ...base,
      logs: [log('2026-07-20'), log('2026-07-21', { food: food('Khichdi') })],
    })
    expect(s.topFood).toEqual({ name: 'Khichdi', count: 1 })
  })

  it('trims whitespace-only names rather than crowning them', () => {
    const s = computeWrappedStats({
      ...base,
      logs: [log('2026-07-20', { food: food('   ') }), log('2026-07-21', { food: food('Sambar') })],
    })
    expect(s.topFood).toEqual({ name: 'Sambar', count: 1 })
  })
})

describe('computeWrappedStats — best day', () => {
  it('crowns the highest-protein day, not the highest-calorie one', () => {
    // A hero card has to be a compliment; "your biggest calorie day" isn't one.
    const s = computeWrappedStats({
      ...base,
      logs: [
        log('2026-07-20', { kcal: 3000, protein_g: 40 }),
        log('2026-07-21', { kcal: 1400, protein_g: 150 }),
      ],
    })
    expect(s.bestDay).toEqual({ date: '2026-07-21', kcal: 1400, proteinG: 150 })
  })

  it('breaks a protein tie with the earlier day, deterministically', () => {
    const s = computeWrappedStats({
      ...base,
      logs: [log('2026-07-22', { protein_g: 90 }), log('2026-07-20', { protein_g: 90 })],
    })
    expect(s.bestDay?.date).toBe('2026-07-20')
  })
})

describe('computeWrappedStats — weight', () => {
  it('reads first-to-last by date, whatever order the rows arrive in', () => {
    const s = computeWrappedStats({
      ...base,
      weighIns: [
        { weight_kg: 78.4, measured_at: noonIst('2026-07-28') },
        { weight_kg: 81.0, measured_at: noonIst('2026-07-01') },
        { weight_kg: 79.9, measured_at: noonIst('2026-07-14') },
      ],
    })
    expect(s.weightDeltaKg).toBe(-2.6)
  })

  it('rounds to one decimal, absorbing float drift', () => {
    const s = computeWrappedStats({
      ...base,
      weighIns: [
        { weight_kg: 82, measured_at: noonIst('2026-07-01') },
        { weight_kg: 78.9, measured_at: noonIst('2026-07-28') },
      ],
    })
    expect(s.weightDeltaKg).toBe(-3.1)
  })

  it('reports a gain as a positive number rather than hiding it', () => {
    const s = computeWrappedStats({
      ...base,
      weighIns: [
        { weight_kg: 70, measured_at: noonIst('2026-07-01') },
        { weight_kg: 71.5, measured_at: noonIst('2026-07-28') },
      ],
    })
    expect(s.weightDeltaKg).toBe(1.5)
  })
})

describe('computeWrappedStats — passthrough and streaks', () => {
  it('passes AI scans through and defaults them to zero', () => {
    expect(computeWrappedStats({ ...base, aiScans: 12 }).aiScans).toBe(12)
    expect(computeWrappedStats(base).aiScans).toBe(0)
  })

  it('derives both streak figures from the same logs', () => {
    const logs = ['2026-07-20', '2026-07-21', '2026-07-22'].map((d) => log(d))
    const s = computeWrappedStats({ ...base, logs })
    expect(s.longestStreakDays).toBe(3)
    // currentStreakDays is relative to today, which is far past these fixtures —
    // so it must be 0 rather than silently reporting the historical run.
    expect(s.currentStreakDays).toBe(0)
  })
})
