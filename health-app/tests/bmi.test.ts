import { describe, it, expect } from 'vitest'
import { computeBmi, bmiCategory, healthyWeightRange, suggestedTargets } from '../lib/bmi'

describe('computeBmi()', () => {
  it('computes kg/m² from weight and height in cm', () => {
    // 70kg at 170cm → 70 / 1.7² = 24.221...
    expect(computeBmi(70, 170)).toBeCloseTo(24.2215, 3)
    // 100kg at 200cm → 25 exactly
    expect(computeBmi(100, 200)).toBe(25)
  })
})

describe('bmiCategory()', () => {
  it('applies WHO cutoffs at the boundaries', () => {
    expect(bmiCategory(18.49)).toBe('underweight')
    expect(bmiCategory(18.5)).toBe('healthy')
    expect(bmiCategory(24.99)).toBe('healthy')
    expect(bmiCategory(25)).toBe('overweight')
    expect(bmiCategory(29.99)).toBe('overweight')
    expect(bmiCategory(30)).toBe('obese')
  })
})

describe('healthyWeightRange()', () => {
  it('returns raw 18.5–24.9 bounds for the height', () => {
    const { minKg, maxKg } = healthyWeightRange(170)
    expect(minKg).toBeCloseTo(18.5 * 1.7 * 1.7, 6)
    expect(maxKg).toBeCloseTo(24.9 * 1.7 * 1.7, 6)
  })
})

describe('suggestedTargets()', () => {
  it('defaults to BMI 20/22/24 target weights', () => {
    const t = suggestedTargets(170)
    expect(t.map((x) => x.bmi)).toEqual([20, 22, 24])
    expect(t[0].kg).toBeCloseTo(20 * 1.7 * 1.7, 6)
  })
})
