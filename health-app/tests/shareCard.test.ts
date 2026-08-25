import { describe, it, expect } from 'vitest'
import { buildShareCardOptions, buildPlateSplit, kgLostFrom, type ShareCardInput } from '../lib/shareCard'

const NOTHING: ShareCardInput = { streakDays: 0, kgLost: null, deficit: null }
const input = (over: Partial<ShareCardInput> = {}): ShareCardInput => ({ ...NOTHING, ...over })
const topics = (over: Partial<ShareCardInput> = {}) =>
  buildShareCardOptions(input(over)).map((o) => o.topic)

describe('kgLostFrom', () => {
  it('subtracts current from start', () => {
    expect(kgLostFrom(82, 78.8)).toBeCloseTo(3.2)
  })

  it('is null when either end is unknown', () => {
    expect(kgLostFrom(null, 78)).toBeNull()
    expect(kgLostFrom(82, null)).toBeNull()
  })

  it('reports a gain as negative rather than hiding it — the caller decides', () => {
    expect(kgLostFrom(70, 71.5)).toBeCloseTo(-1.5)
  })
})

describe('buildShareCardOptions', () => {
  it('returns nothing to share when there is nothing to brag about', () => {
    expect(buildShareCardOptions(NOTHING)).toEqual([])
    expect(buildShareCardOptions(input({ kgLost: 0 }))).toEqual([])
  })

  it('never brags about the wrong direction', () => {
    expect(topics({ kgLost: -1.5 })).toEqual([])
  })

  it('ignores sub-0.1kg scale noise', () => {
    expect(topics({ kgLost: 0.05 })).toEqual([])
  })

  // The bug this rewrite exists to fix: the old builder made the streak the
  // hero whenever it was >= 1, so 8 kg down with a 2-day streak posted "2".
  it('puts a kilo or more ahead of any streak', () => {
    expect(topics({ kgLost: 8, streakDays: 2 })).toEqual(['weight', 'streak'])
    expect(topics({ kgLost: 8, streakDays: 400 })).toEqual(['weight', 'streak'])
  })

  it('puts a week-long streak ahead of a smaller loss', () => {
    expect(topics({ kgLost: 0.4, streakDays: 12 })).toEqual(['streak', 'weight'])
  })

  it('keeps a short streak behind a small loss', () => {
    expect(topics({ kgLost: 0.4, streakDays: 2 })).toEqual(['weight', 'streak'])
  })

  it('always ranks the deficit last — it is the least legible number to a friend', () => {
    expect(
      topics({ kgLost: 8, streakDays: 30, deficit: { kcal: 3240, period: 'week', daysLogged: 6, fatKg: 0.42 } })
    ).toEqual(['weight', 'streak', 'deficit'])
  })

  it('offers the deficit on its own when it is all the user has', () => {
    expect(topics({ deficit: { kcal: 3240, period: 'week', daysLogged: 6, fatKg: 0.42 } })).toEqual(['deficit'])
  })

  it('leads the weight card with the kilos and carries the streak underneath', () => {
    const [weight] = buildShareCardOptions(input({ kgLost: 3.24, streakDays: 12 }))
    expect(weight.data).toEqual({
      hero: { value: '3.2 kg', label: 'down since I started' },
      subline: '12 day logging streak',
    })
  })

  it('leaves the weight card sublineless when there is no streak', () => {
    const [weight] = buildShareCardOptions(input({ kgLost: 3.2 }))
    expect(weight.data.subline).toBeNull()
  })

  it('leads the streak card with the day count and the loss underneath', () => {
    const [streak] = buildShareCardOptions(input({ streakDays: 12, kgLost: 0.4 }))
    expect(streak.data).toEqual({
      hero: { value: '12', label: 'day streak' },
      subline: '▼ 0.4 kg down since I started',
    })
  })

  it('streak card has no subline with no weight data', () => {
    const [streak] = buildShareCardOptions(input({ streakDays: 5 }))
    expect(streak.data).toEqual({ hero: { value: '5', label: 'day streak' }, subline: null })
  })

  // CLAUDE.md: anything comparing a day to a benchmark must say which benchmark.
  // "3,240 kcal" is a miss against a 1,600 eat-goal and a win against maintenance.
  it('names maintenance as the benchmark on the deficit card', () => {
    const [deficit] = buildShareCardOptions(
      input({ deficit: { kcal: 3240, period: 'week', daysLogged: 6, fatKg: 0.42 } })
    )
    expect(deficit.data.hero.label).toBe('kcal under maintenance')
    expect(deficit.data.hero.value).toBe('3,240')
    expect(deficit.data.subline).toBe('This week · 6 days logged · 0.42 kg of fat')
  })

  it('labels the month period distinctly, so the two deficits can never be confused', () => {
    const [deficit] = buildShareCardOptions(
      input({ deficit: { kcal: 14200, period: 'month', daysLogged: 24, fatKg: 1.84 } })
    )
    expect(deficit.label).toBe("This month's deficit")
    expect(deficit.data.subline).toContain('This month')
  })

  it('singularises a one-day deficit', () => {
    const [deficit] = buildShareCardOptions(
      input({ deficit: { kcal: 500, period: 'week', daysLogged: 1, fatKg: 0.06 } })
    )
    expect(deficit.data.subline).toBe('This week · 1 day logged · 0.06 kg of fat')
  })

  // A surplus is not a brag, and a period with no completed days has no number.
  it('drops a deficit that is a surplus or has no logged days', () => {
    expect(topics({ deficit: { kcal: -800, period: 'week', daysLogged: 5, fatKg: -0.1 } })).toEqual([])
    expect(topics({ deficit: { kcal: 3240, period: 'week', daysLogged: 0, fatKg: 0.42 } })).toEqual([])
  })

  // The monthly Wrapped shares a card built from one month's snapshot. Left on
  // the default it would claim a lifetime total for a month's loss.
  it('scopes the weight copy to the period the caller names', () => {
    const [weight] = buildShareCardOptions(input({ kgLost: 1.8, sinceLabel: 'in August' }))
    expect(weight.data.hero.label).toBe('down in August')
  })

  it('scopes the streak subline to the same period', () => {
    const [streak] = buildShareCardOptions(
      input({ streakDays: 20, kgLost: 0.4, sinceLabel: 'in August' })
    )
    expect(streak.data.subline).toBe('▼ 0.4 kg down in August')
  })

  it('defaults to the lifetime wording when no period is named', () => {
    const [weight] = buildShareCardOptions(input({ kgLost: 1.8 }))
    expect(weight.data.hero.label).toBe('down since I started')
  })

  it('gives every option a chooser label', () => {
    const options = buildShareCardOptions(
      input({ kgLost: 3, streakDays: 12, deficit: { kcal: 3240, period: 'week', daysLogged: 6, fatKg: 0.42 } })
    )
    expect(options.map((o) => o.label)).toEqual(['Weight lost', 'Streak', "This week's deficit"])
  })
})

describe('buildPlateSplit', () => {
  it('normalises grams into fractions of the plate', () => {
    const split = buildPlateSplit({ proteinG: 100, carbsG: 200, fatG: 100 })!
    expect(split.protein).toBeCloseTo(0.25)
    expect(split.carbs).toBeCloseTo(0.5)
    expect(split.fat).toBeCloseTo(0.25)
  })

  it('always sums to one, so the katoris can never overflow the plate', () => {
    for (const m of [
      { proteinG: 1, carbsG: 1, fatG: 1 },
      { proteinG: 137, carbsG: 12, fatG: 3 },
      { proteinG: 0, carbsG: 250, fatG: 0 },
    ]) {
      const s = buildPlateSplit(m)!
      expect(s.protein + s.carbs + s.fat).toBeCloseTo(1)
    }
  })

  it('divides by grams, not calories — a spoon of oil is not a bowl of rice', () => {
    // 50 g fat is 450 kcal vs 50 g carbs at 200 kcal. By grams they tie, which
    // is what someone looking at a plate expects to see.
    const split = buildPlateSplit({ proteinG: 0, carbsG: 50, fatG: 50 })!
    expect(split.carbs).toBeCloseTo(split.fat)
  })

  it('returns null when there is nothing to divide, so the plate stays plain', () => {
    expect(buildPlateSplit(null)).toBeNull()
    expect(buildPlateSplit(undefined)).toBeNull()
    expect(buildPlateSplit({ proteinG: 0, carbsG: 0, fatG: 0 })).toBeNull()
  })

  it('treats negative or missing grams as zero rather than inverting a bowl', () => {
    const split = buildPlateSplit({ proteinG: -20, carbsG: 100, fatG: NaN })!
    expect(split.protein).toBe(0)
    expect(split.fat).toBe(0)
    expect(split.carbs).toBeCloseTo(1)
  })
})
