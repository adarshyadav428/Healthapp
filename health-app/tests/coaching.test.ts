import { describe, it, expect } from 'vitest'
import { coachingLine, dayContextFor } from '../lib/coaching'

const targets = { kcal: 2000, protein: 120 }

/** What useDailyTotals returns while loading AND on failure — the ambiguity. */
const ZERO = { kcal: 0, protein_g: 0 }

describe('coachingLine', () => {
  it('returns null without usable meal or targets', () => {
    expect(coachingLine({ kcal: 0, protein: 0 }, targets)).toBeNull()
    expect(coachingLine({ kcal: 500, protein: 30 }, { kcal: 0, protein: 0 })).toBeNull()
  })

  it('praises a protein-dense meal', () => {
    // 40g protein = 33% of 120g target → protein praise
    const line = coachingLine({ kcal: 500, protein: 40 }, targets)
    expect(line).toContain('40g')
    expect(line).toMatch(/protein/i)
  })

  it('warns to keep the next meal light for a big meal', () => {
    // 1000 kcal = 50% of the day
    const line = coachingLine({ kcal: 1000, protein: 20 }, targets)
    expect(line).toMatch(/50%/)
    expect(line).toMatch(/light/i)
  })

  it('reassures on a light meal', () => {
    const line = coachingLine({ kcal: 200, protein: 5 }, targets)
    expect(line).toMatch(/10%/)
  })

  describe('with the day so far (the honest version)', () => {
    // The bug this argument exists to kill: a small snack on a day that is
    // already blown used to be described as "a light 12% of your day — good
    // room left for balanced meals".
    it('does not claim there is room left when the user is already over', () => {
      const line = coachingLine({ kcal: 200, protein: 5 }, { kcal: 1600, protein: 120 }, { kcal: 1900, protein: 80 })
      expect(line).not.toMatch(/room left/i)
      expect(line).not.toMatch(/on track/i)
      expect(line).toMatch(/over for today/)
      expect(line).toMatch(/500/) // 1900 + 200 - 1600
    })

    it('offers the walk only when a walk would actually cover the overage', () => {
      // 100 over — a 30-minute walk (~150 kcal) genuinely closes this.
      const small = coachingLine({ kcal: 200, protein: 2 }, { kcal: 2000, protein: 120 }, { kcal: 1900, protein: 60 })
      expect(small).toMatch(/30-minute walk/)

      // 500 over — promising a walk covers it would be a lie.
      const big = coachingLine({ kcal: 600, protein: 2 }, { kcal: 2000, protein: 120 }, { kcal: 1900, protein: 60 })
      expect(big).not.toMatch(/walk/)
      expect(big).toMatch(/tomorrow starts clean/)
    })

    it('states the remaining budget when there is real room', () => {
      // 400 eaten + 500 meal against 2000 = 1100 left.
      const line = coachingLine({ kcal: 500, protein: 10 }, targets, { kcal: 400, protein: 20 })
      expect(line).toMatch(/1,?100 kcal for the rest of today/)
    })

    it('says the budget is nearly spent rather than pretending there is room', () => {
      // 1850 + 100 against 2000 = 50 left — real, but not worth calling "room".
      const line = coachingLine({ kcal: 100, protein: 2 }, targets, { kcal: 1850, protein: 90 })
      expect(line).toMatch(/just about spent/)
      expect(line).toMatch(/50 kcal left/)
    })

    it('still praises protein when the day is over budget', () => {
      // Being over doesn't make 40g of protein less good.
      const line = coachingLine({ kcal: 500, protein: 40 }, targets, { kcal: 1900, protein: 60 })
      expect(line).toMatch(/Solid protein — 40g here/)
      expect(line).toMatch(/over for today/)
    })

    it('treats an exactly-on-target day as spent, not as over', () => {
      // Exactly 0 left. Not over, so it must not say "over" — and it must not
      // quote the remainder either: round10 renders that as "roughly 0 kcal
      // left", which reads as a rounding bug rather than a budget.
      const line = coachingLine({ kcal: 100, protein: 2 }, targets, { kcal: 1900, protein: 90 })
      expect(line).not.toMatch(/over for today/)
      expect(line).toMatch(/budget spent, almost exactly/)
      expect(line).not.toMatch(/0 kcal left/)
    })

    it('does not quote a remainder too small to act on', () => {
      // 1996 + 1 against 2000 = 3 left.
      const line = coachingLine({ kcal: 1, protein: 0 }, targets, { kcal: 1996, protein: 90 })
      expect(line).not.toMatch(/kcal left/)
    })

    it('is unchanged when no day context is supplied', () => {
      const withoutDay = coachingLine({ kcal: 500, protein: 40 }, targets)
      expect(withoutDay).toMatch(/25% of your day/)
      expect(withoutDay).toMatch(/on track/)
    })
  })
})

/**
 * The seam between the hook and the sentence. `useDailyTotals` returns zeroed
 * totals both while loading and on failure, and those zeros look exactly like a
 * genuinely untouched day — so passing them through would tell someone who has
 * eaten 1,900 kcal that their whole budget is still available, in the confident
 * voice of a measured number.
 */
describe('dayContextFor', () => {
  const totals = { kcal: 1900, protein_g: 90 }

  it('passes the totals through once they have loaded', () => {
    expect(dayContextFor({ totals, isLoading: false, error: null })).toEqual({
      kcal: 1900,
      protein: 90,
    })
  })

  it('withholds context while the totals are still loading', () => {
    expect(dayContextFor({ totals: ZERO, isLoading: true, error: null })).toBeUndefined()
  })

  it('withholds context when the read failed', () => {
    expect(
      dayContextFor({ totals: ZERO, isLoading: false, error: new Error('offline') })
    ).toBeUndefined()
  })

  it('withholds context even if loaded totals arrive alongside an error', () => {
    expect(dayContextFor({ totals, isLoading: false, error: new Error('stale') })).toBeUndefined()
  })

  it('reports a genuine zero day as zero, not as unknown', () => {
    // A real untouched day IS zero, and must still get the honest budget line —
    // withholding here would lose the feature for everyone's first meal.
    expect(dayContextFor({ totals: ZERO, isLoading: false, error: null })).toEqual({
      kcal: 0,
      protein: 0,
    })
  })

  it('produces a sentence that never promises budget the user does not have', () => {
    // End to end: an over-budget day whose read failed must not claim room.
    const failed = dayContextFor({ totals: ZERO, isLoading: false, error: new Error('offline') })
    const line = coachingLine({ kcal: 200, protein: 5 }, targets, failed)

    expect(line).not.toMatch(/leaves you about/)
    expect(line).not.toMatch(/kcal left/)
  })
})
