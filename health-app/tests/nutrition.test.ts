import { describe, it, expect } from 'vitest'
import { scaleMacros } from '../lib/nutrition'

const food = { kcal_per_100g: 180, protein_g_per_100g: 8, carbs_g_per_100g: 25, fat_g_per_100g: 5 }

describe('scaleMacros', () => {
  it('scales per-100g values by grams', () => {
    expect(scaleMacros(food, 150)).toEqual({ kcal: 270, protein_g: 12, carbs_g: 37.5, fat_g: 7.5 })
  })

  it('multiplies by servings (regression: saved-meal re-log undercounted servings > 1)', () => {
    // 2 servings of 150g must be double the single-serving totals —
    // the old /api/meals/log math ignored servings entirely.
    expect(scaleMacros(food, 150, 2)).toEqual({ kcal: 540, protein_g: 24, carbs_g: 75, fat_g: 15 })
  })

  it('matches the /api/logs/add rounding contract (round to 2dp)', () => {
    const r = scaleMacros({ kcal_per_100g: 33.3, protein_g_per_100g: 1.11, carbs_g_per_100g: 2.22, fat_g_per_100g: 0.37 }, 77)
    expect(r.kcal).toBe(25.64)
    expect(r.protein_g).toBe(0.85)
    expect(r.carbs_g).toBe(1.71)
    expect(r.fat_g).toBe(0.28)
  })

  it('defaults servings to 1', () => {
    expect(scaleMacros(food, 100)).toEqual(scaleMacros(food, 100, 1))
  })
})
