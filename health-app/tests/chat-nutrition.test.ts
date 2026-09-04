import { describe, it, expect } from 'vitest'
import { resolveChatItemNutrition, type ChatItem } from '../lib/chat-nutrition'

const base: ChatItem = {
  name: 'Dal',
  portion_desc: '1 katori',
  grams: 150,
  kcal_per_100g: 120,
  protein_g_per_100g: 8,
  carbs_g_per_100g: 15,
  fat_g_per_100g: 2,
}

describe('resolveChatItemNutrition()', () => {
  it('passes plausible model numbers through unchanged', () => {
    const r = resolveChatItemNutrition(base)
    expect(r).toEqual({
      kcal_per_100g: 120,
      protein_g_per_100g: 8,
      carbs_g_per_100g: 15,
      fat_g_per_100g: 2,
      plausible: true,
    })
  })

  it('clamps a hallucinated macro set instead of writing it verbatim', () => {
    // The exact class of bug this closes: nothing stopped a 900 kcal/100g dal
    // reaching the shared `estimate` catalogue before this.
    const r = resolveChatItemNutrition({
      ...base,
      kcal_per_100g: 900,
      protein_g_per_100g: 60,
      carbs_g_per_100g: 90,
      fat_g_per_100g: 40,
    })
    expect(r.plausible).toBe(false)
    expect(r.protein_g_per_100g + r.carbs_g_per_100g + r.fat_g_per_100g).toBeLessThanOrEqual(100.001)
    expect(r.kcal_per_100g).toBeLessThanOrEqual(900)
  })

  it('treats missing/non-numeric fields as zero rather than throwing', () => {
    const r = resolveChatItemNutrition({
      ...base,
      kcal_per_100g: undefined as unknown as number,
      protein_g_per_100g: NaN as unknown as number,
    })
    expect(r.plausible).toBe(false) // missing kcal coerces to 0, which fails isPlausible's "kcal > 0" check
    expect(Number.isFinite(r.kcal_per_100g)).toBe(true)
  })

  it('rejects energy that wildly mismatches the macros (Atwater check)', () => {
    const r = resolveChatItemNutrition({ ...base, kcal_per_100g: 700, protein_g_per_100g: 2, carbs_g_per_100g: 5, fat_g_per_100g: 1 })
    expect(r.plausible).toBe(false)
  })
})
