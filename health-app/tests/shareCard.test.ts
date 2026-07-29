import { describe, it, expect } from 'vitest'
import { buildShareCardData, buildPlateSplit } from '../lib/shareCard'

describe('buildShareCardData', () => {
  it('makes the streak the hero and shows weight loss as the subline', () => {
    expect(
      buildShareCardData({ streakDays: 12, startWeightKg: 82, currentWeightKg: 78.8 })
    ).toEqual({
      hero: { value: '12', label: 'day streak' },
      subline: '3.2 kg down since starting',
    })
  })

  it('streak hero with no weight data has no subline', () => {
    expect(
      buildShareCardData({ streakDays: 5, startWeightKg: null, currentWeightKg: null })
    ).toEqual({ hero: { value: '5', label: 'day streak' }, subline: null })
  })

  it('ignores weight gain (never brags about the wrong direction)', () => {
    expect(
      buildShareCardData({ streakDays: 5, startWeightKg: 70, currentWeightKg: 71.5 })
    ).toEqual({ hero: { value: '5', label: 'day streak' }, subline: null })
  })

  it('ignores sub-0.1kg noise', () => {
    expect(
      buildShareCardData({ streakDays: 5, startWeightKg: 70.05, currentWeightKg: 70 })
    ).toEqual({ hero: { value: '5', label: 'day streak' }, subline: null })
  })

  it('falls back to weight loss as the hero when there is no streak', () => {
    expect(
      buildShareCardData({ streakDays: 0, startWeightKg: 82, currentWeightKg: 79 })
    ).toEqual({ hero: { value: '3.0 kg', label: 'down since starting' }, subline: null })
  })

  it('returns null when there is nothing to share yet', () => {
    expect(
      buildShareCardData({ streakDays: 0, startWeightKg: null, currentWeightKg: null })
    ).toBe(null)
    expect(
      buildShareCardData({ streakDays: 0, startWeightKg: 70, currentWeightKg: 70 })
    ).toBe(null)
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
