import { describe, it, expect } from 'vitest'
import { CURATED_FOODS } from '../lib/curated-foods-data'
import { INDIAN_FOODS } from '../lib/indian-foods-data'
import { isPlausibleFood, SOURCE_RANK } from '../lib/foodMatch'

const normalize = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Guardrails for the generated catalogue in `data/indian-foods.json`.
 *
 * These values are category estimates, not measurements, so the bar here is
 * "not misleading" rather than "accurate". They exist because the generator
 * originally filed meat dishes under carb categories and shipped Chicken
 * Biryani at 4.3 g protein/100 g against a measured 10.2 — the kind of error
 * that makes a macro tracker actively wrong. Regenerate with
 * `npx tsx scripts/generate-indian-foods-estimate.ts` if these fail.
 */
describe('curated foods dataset', () => {
  it('is non-empty and uses the curated source label', () => {
    expect(CURATED_FOODS.length).toBeGreaterThan(500)
    for (const food of CURATED_FOODS) {
      expect(food.source).toBe('curated')
    }
  })

  it('never reuses a source_id', () => {
    const ids = new Set(CURATED_FOODS.map((f) => f.source_id))
    expect(ids.size).toBe(CURATED_FOODS.length)
  })

  it('gives every meat, fish and paneer dish a believable protein figure', () => {
    const proteinDish = /chicken|mutton|fish|prawn|egg|keema|kheema|murg|gosht|lamb|paneer|tikka|kebab|kabab/i
    const offenders = CURATED_FOODS.filter(
      (f) => proteinDish.test(f.name) && f.protein_g_per_100g < 7
    ).map((f) => `${f.name} (${f.protein_g_per_100g}g)`)

    expect(offenders).toEqual([])
  })

  it('treats regional biryanis as the meat dishes they are', () => {
    const regional = CURATED_FOODS.filter((f) =>
      /\b(hyderabadi|lucknowi|kolkata|ambur|thalassery|dindigul)\b/i.test(f.name)
    )
    expect(regional.length).toBeGreaterThan(0)
    for (const food of regional) {
      expect(food.protein_g_per_100g).toBeGreaterThanOrEqual(7)
    }
  })

  it('contains the regional biryanis users actually search for', () => {
    const names = new Set(CURATED_FOODS.map((f) => normalize(f.name)))
    for (const expected of [
      'hyderabadi biryani',
      'hyderabadi chicken biryani',
      'lucknowi biryani',
      'kolkata biryani',
      'egg biryani',
    ]) {
      expect(names.has(expected)).toBe(true)
    }
  })

  it('holds no physically impossible row', () => {
    const impossible = CURATED_FOODS.filter((f) => !isPlausibleFood(f)).map((f) => f.name)
    expect(impossible).toEqual([])
  })

  it('derives kcal consistently from its own macros', () => {
    for (const food of CURATED_FOODS) {
      const implied =
        food.protein_g_per_100g * 4 + food.carbs_g_per_100g * 4 + food.fat_g_per_100g * 9
      expect(Math.abs(implied - food.kcal_per_100g)).toBeLessThan(1)
    }
  })

  it('carries a real serving size, not the 100g placeholder', () => {
    for (const food of CURATED_FOODS) {
      expect(food.serving_size_g).toBeGreaterThan(0)
      expect(food.serving_description).toBeTruthy()
    }
  })

  it('never duplicates a measured IFCT name', () => {
    const ifctNames = new Set(INDIAN_FOODS.map((f) => normalize(f.name)))
    const collisions = CURATED_FOODS.filter((f) => ifctNames.has(normalize(f.name))).map((f) => f.name)
    expect(collisions).toEqual([])
  })

  it('never duplicates an IFCT dish that only differs by a vernacular gloss', () => {
    // IFCT writes "Boiled Egg (Anda)", "Apple (Seb)", "Butter Chicken (Murgh
    // Makhani)"; the curated name is the same dish without the parenthetical.
    // The estimate must defer to the measured row rather than sit beside it.
    const ifctBaseNames = new Set(
      INDIAN_FOODS.map((f) => normalize(f.name).match(/^(.+?) \(.*\)$/)?.[1]).filter(
        (n): n is string => Boolean(n)
      )
    )
    const collisions = CURATED_FOODS.filter((f) => ifctBaseNames.has(normalize(f.name))).map(
      (f) => f.name
    )
    expect(collisions).toEqual([])
  })

  it('ranks below every measured source so IFCT wins a tie', () => {
    expect(SOURCE_RANK.curated).toBeLessThan(SOURCE_RANK.ifct)
    expect(SOURCE_RANK.curated).toBeLessThan(SOURCE_RANK.off)
    expect(SOURCE_RANK.curated).toBeGreaterThan(SOURCE_RANK.estimate)
  })
})
