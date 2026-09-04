import { describe, it, expect } from 'vitest'
import { resolveChatItemNutrition, parseStatedTotal, type ChatItem } from '../lib/chat-nutrition'

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

describe('parseStatedTotal()', () => {
  it('reads a plain gram figure and the noun phrase after it', () => {
    const r = parseStatedTotal('ate 200g paneer butter masala')
    expect(r).toEqual({ grams: 200, anchorHint: 'paneer butter masala' })
  })

  it('converts kg to grams', () => {
    expect(parseStatedTotal('1kg chicken curry')).toEqual({ grams: 1000, anchorHint: 'chicken curry' })
  })

  it('skips a leading "of" between the weight and the dish name', () => {
    const r = parseStatedTotal('750g of Hyderabadi chicken biryani which contained chicken')
    expect(r).toEqual({ grams: 750, anchorHint: 'Hyderabadi chicken biryani' })
  })

  it('stops the anchor hint at containment/list language, not mid-dish', () => {
    expect(parseStatedTotal('500g rajma chawal with extra rice')?.anchorHint).toBe('rajma chawal')
  })

  it('understands Hinglish fractional-kg phrasing', () => {
    expect(parseStatedTotal('aadha kg biryani')).toEqual({ grams: 500, anchorHint: 'biryani' })
    expect(parseStatedTotal('pauna kg chicken curry')).toEqual({ grams: 750, anchorHint: 'chicken curry' })
    expect(parseStatedTotal('dedh kg chicken biryani')).toEqual({ grams: 1500, anchorHint: 'chicken biryani' })
  })

  it('returns null when the message states no weight at all', () => {
    expect(parseStatedTotal('2 roti, dal, bhindi sabzi')).toBeNull()
  })

  it('returns null when the message states more than one weight — ambiguous, so do nothing', () => {
    expect(parseStatedTotal('500g biryani and 200g raita')).toBeNull()
  })
})
