import { describe, it, expect } from 'vitest'
import { resolveNutrition, num, piecesInServing, type GeminiFood } from '../lib/camera-nutrition'

const base: GeminiFood = {
  name: 'Test food',
  estimated_grams: 150,
  kcal_per_100g: 180,
  protein_g_per_100g: 8,
  carbs_g_per_100g: 25,
  fat_g_per_100g: 5,
}

describe('num()', () => {
  it('parses numbers and numeric strings, rejects negatives and junk', () => {
    expect(num(42)).toBe(42)
    expect(num('42.5')).toBe(42.5)
    expect(num(-1)).toBeNull()
    expect(num('abc')).toBeNull()
    expect(num(undefined)).toBeNull()
    expect(num(Infinity)).toBeNull()
  })
})

describe('resolveNutrition()', () => {
  it('falls back to model estimates when no label is present', () => {
    const r = resolveNutrition(base)
    expect(r.fromLabel).toBe(false)
    expect(r.kcal_per_100g).toBe(180)
    expect(r.portion).toBe(150)
    expect(r.unit).toBe('g')
    expect(r.plausible).toBe(true)
  })

  it('clamps a physically impossible freeform estimate and flags it implausible', () => {
    const r = resolveNutrition({
      ...base,
      kcal_per_100g: 2000, protein_g_per_100g: 90, carbs_g_per_100g: 150, fat_g_per_100g: 80,
    })
    expect(r.plausible).toBe(false)
    expect(r.kcal_per_100g).toBeLessThanOrEqual(900)
    // clamped macros fit within the food's own mass
    expect(r.protein_g_per_100g + r.carbs_g_per_100g + r.fat_g_per_100g).toBeLessThanOrEqual(100.001)
  })

  it('scales per-serving label panel to per-100 (worked example A: 45g protein chips)', () => {
    const r = resolveNutrition({
      ...base,
      label: {
        panel_amount: 45, energy_kcal: 194, protein_g: 10, carbs_g: 29, fat_g: 4,
        serving_size: 45, servings_per_pack: 1, net_quantity: 45, unit: 'g',
      },
    })!
    expect(r.fromLabel).toBe(true)
    expect(r.kcal_per_100g).toBeCloseTo(431.1, 1)
    // single-serve pack → portion defaults to the whole pack (this is the
    // branch whose `portion` redeclaration broke the production build)
    expect(r.portion).toBe(45)
  })

  it('uses per-100ml panel as-is and portions to the pack (worked example B: buttermilk pouch)', () => {
    const r = resolveNutrition({
      ...base,
      label: {
        panel_amount: 100, energy_kcal: 20, protein_g: 1.2, carbs_g: 1.2, fat_g: 1.2,
        serving_size: 270, servings_per_pack: 1, net_quantity: 270, unit: 'ml',
      },
    })!
    expect(r.fromLabel).toBe(true)
    expect(r.kcal_per_100g).toBe(20)
    expect(r.portion).toBe(270)
    expect(r.unit).toBe('ml')
  })

  it('rejects a label whose energy wildly mismatches its macros (Atwater check)', () => {
    const r = resolveNutrition({
      ...base,
      label: { panel_amount: 100, energy_kcal: 700, protein_g: 2, carbs_g: 5, fat_g: 1 },
    })!
    expect(r.fromLabel).toBe(false) // fell back to model estimate
    expect(r.kcal_per_100g).toBe(180)
  })

  it('normalizes pcs totals to per-100 without inventing gram weights', () => {
    const r = resolveNutrition({
      ...base,
      estimated_grams: 6,
      unit: 'pcs',
      total_kcal: 540, total_protein_g: 48, total_carbs_g: 12, total_fat_g: 33,
    })!
    expect(r.fromServingTotal).toBe(true)
    expect(r.unit).toBe('pcs')
    expect(r.portion).toBe(6)
    // per-"100 pcs" so that portion/100 × value = the displayed total
    expect((r.kcal_per_100g * 6) / 100).toBeCloseTo(540, 6)
  })

  it('falls back (not null) for pcs items missing totals so the route can still try a DB match', () => {
    const r = resolveNutrition({ ...base, unit: 'pcs' })
    expect(r.fromServingTotal).toBe(false)
    expect(r.unit).toBe('pcs')
  })

  it('rejects pcs totals whose energy contradicts their macros (Atwater on totals)', () => {
    // energy copied from a whole bucket, macros from a single wing
    const r = resolveNutrition({
      ...base,
      estimated_grams: 6,
      unit: 'pcs',
      total_kcal: 5400, total_protein_g: 4.8, total_carbs_g: 1.2, total_fat_g: 3.3,
    })
    expect(r.fromServingTotal).toBe(false) // fell back instead of trusting the totals
  })
})

describe('piecesInServing()', () => {
  it('reads the leading piece count from a serving description, defaulting to 1', () => {
    expect(piecesInServing('5 pieces (150g)')).toBe(5)
    expect(piecesInServing('1 piece (60g)')).toBe(1)
    expect(piecesInServing('100g')).toBe(1)
    expect(piecesInServing(null)).toBe(1)
  })
})
