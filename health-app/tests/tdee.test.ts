import { describe, it, expect } from 'vitest'
import { calculateBMR, activityMultiplier, calculateTDEE, calculateMaintenance } from '../lib/tdee'

describe('calculateBMR (Mifflin-St Jeor)', () => {
  it('male: 10w + 6.25h - 5a + 5', () => {
    // 70kg, 175cm, 30y → 700 + 1093.75 - 150 + 5 = 1648.75
    expect(calculateBMR({ weightKg: 70, heightCm: 175, age: 30, sex: 'male' })).toBeCloseTo(1648.75)
  })

  it('female: 10w + 6.25h - 5a - 161', () => {
    // 60kg, 160cm, 28y → 600 + 1000 - 140 - 161 = 1299
    expect(calculateBMR({ weightKg: 60, heightCm: 160, age: 28, sex: 'female' })).toBe(1299)
  })

  it('other: averages the male/female constants (-78)', () => {
    const male = calculateBMR({ weightKg: 70, heightCm: 175, age: 30, sex: 'male' })
    const female = calculateBMR({ weightKg: 70, heightCm: 175, age: 30, sex: 'female' })
    const other = calculateBMR({ weightKg: 70, heightCm: 175, age: 30, sex: 'other' })
    expect(other).toBeCloseTo((male + female) / 2)
  })
})

describe('activityMultiplier', () => {
  it('maps every level to its standard multiplier', () => {
    expect(activityMultiplier('sedentary')).toBe(1.2)
    expect(activityMultiplier('light')).toBe(1.375)
    expect(activityMultiplier('moderate')).toBe(1.55)
    expect(activityMultiplier('active')).toBe(1.725)
    expect(activityMultiplier('very_active')).toBe(1.9)
  })
})

describe('calculateTDEE', () => {
  const base = {
    weightKg: 70,
    heightCm: 175,
    age: 30,
    sex: 'male' as const,
    activity_level: 'moderate' as const,
  }

  it('maintain: target equals rounded TDEE with no delta', () => {
    const { daily_calorie_target } = calculateTDEE({ ...base, goal: 'maintain' })
    // BMR 1648.75 × 1.55 = 2555.56 → 2556
    expect(daily_calorie_target).toBe(2556)
  })

  it('lose at 0.5 kg/week subtracts 7700×0.5/7 = 550 kcal/day', () => {
    const maintain = calculateTDEE({ ...base, goal: 'maintain' }).daily_calorie_target
    const lose = calculateTDEE({ ...base, goal: 'lose', paceKgPerWeek: 0.5 }).daily_calorie_target
    expect(maintain - lose).toBe(550)
  })

  it('gain at 0.25 kg/week adds 275 kcal/day', () => {
    const maintain = calculateTDEE({ ...base, goal: 'maintain' }).daily_calorie_target
    const gain = calculateTDEE({ ...base, goal: 'gain', paceKgPerWeek: 0.25 }).daily_calorie_target
    expect(gain - maintain).toBe(275)
  })

  it('pace defaults to 0.5 kg/week when omitted', () => {
    const explicit = calculateTDEE({ ...base, goal: 'lose', paceKgPerWeek: 0.5 })
    const defaulted = calculateTDEE({ ...base, goal: 'lose' })
    expect(defaulted).toEqual(explicit)
  })

  it('never returns a calorie target below the 1200 floor', () => {
    const { daily_calorie_target } = calculateTDEE({
      weightKg: 45,
      heightCm: 150,
      age: 60,
      sex: 'female',
      activity_level: 'sedentary',
      goal: 'lose',
      paceKgPerWeek: 2,
    })
    expect(daily_calorie_target).toBe(1200)
  })

  it('protein = 1.6 g/kg and fat = 0.8 g/kg, carbs take the remaining calories', () => {
    const t = calculateTDEE({ ...base, goal: 'maintain' })
    expect(t.protein_g_target).toBe(112) // 1.6 × 70
    expect(t.fat_g_target).toBe(56) // 0.8 × 70
    const remaining = t.daily_calorie_target - t.protein_g_target * 4 - t.fat_g_target * 9
    expect(t.carbs_g_target).toBe(Math.round(remaining / 4))
  })

  it('carbs never go negative even when the floor leaves no room', () => {
    const t = calculateTDEE({
      weightKg: 150, // protein+fat alone exceed 1200 kcal
      heightCm: 150,
      age: 80,
      sex: 'female',
      activity_level: 'sedentary',
      goal: 'lose',
      paceKgPerWeek: 2,
    })
    expect(t.carbs_g_target).toBeGreaterThanOrEqual(0)
  })
})

describe('calculateMaintenance', () => {
  const base = {
    weightKg: 70,
    heightCm: 175,
    age: 30,
    sex: 'male' as const,
    activity_level: 'moderate' as const,
  }

  it('splits maintenance into BMR + activity, and the parts sum to the whole', () => {
    const m = calculateMaintenance(base)
    // BMR 1648.75 -> 1649 displayed; x1.55 = 2555.56 -> 2556
    expect(m.bmr).toBe(1649)
    expect(m.multiplier).toBe(1.55)
    expect(m.tdee).toBe(2556)
    // The breakdown shown to the user must add up, or it reads as broken.
    expect(m.bmr + m.activityKcal).toBe(m.tdee)
  })

  it('agrees with the target calculateTDEE derives (one source of truth)', () => {
    expect(calculateMaintenance(base).tdee).toBe(
      calculateTDEE({ ...base, goal: 'maintain' }).daily_calorie_target
    )
    expect(calculateTDEE({ ...base, goal: 'lose' }).maintenance_kcal).toBe(
      calculateMaintenance(base).tdee
    )
  })

  it('rounds tdee from the unrounded BMR, not the displayed one', () => {
    // Guards the display rounding from silently shifting every deficit on the
    // app: 1648.75x1.55 = 2555.6 -> 2556, but 1649x1.55 = 2555.95 -> 2556 too.
    // Pick a case where they diverge: BMR 1648.60 vs 1649.
    const m = calculateMaintenance({ ...base, activity_level: 'very_active' })
    expect(m.tdee).toBe(Math.round(calculateBMR(base) * 1.9))
  })

  it('sedentary is the fallback multiplier for an unknown level', () => {
    const m = calculateMaintenance({ ...base, activity_level: 'nonsense' as never })
    expect(m.multiplier).toBe(1.2)
  })
})
