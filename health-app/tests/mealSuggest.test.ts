import { describe, it, expect } from 'vitest'
import {
  suggestMeals, servingGrams, MAX_GAP_SHARE, MIN_USEFUL_KCAL,
} from '../lib/mealSuggest'
import type { Food } from '../types/index'

function food(over: Partial<Food> & { id: string; name: string }): Food {
  return {
    source: 'ifct',
    source_id: null,
    brand: null,
    serving_size_g: 100,
    serving_description: '100 g',
    kcal_per_100g: 150,
    protein_g_per_100g: 8,
    carbs_g_per_100g: 20,
    fat_g_per_100g: 4,
    fiber_g_per_100g: null,
    common_portions: null,
    ...over,
  } as Food
}

const gap = (kcal: number, protein = 0) => ({ kcalRemaining: kcal, proteinRemainingG: protein })

describe('servingGrams', () => {
  it('prefers the food’s own declared portion', () => {
    expect(servingGrams(food({
      id: 'a', name: 'Roti', serving_size_g: 100,
      common_portions: [{ unit: 'piece', grams: 40, label: '1 roti' }],
    }))).toBe(40)
  })

  it('falls back to the serving size, then to 100 g', () => {
    expect(servingGrams(food({ id: 'b', name: 'Dal', serving_size_g: 150 }))).toBe(150)
    expect(servingGrams(food({ id: 'c', name: 'X', serving_size_g: 0 }))).toBe(100)
  })
})

describe('suggestMeals — when not to suggest', () => {
  it('says nothing when there is no meaningful room left', () => {
    const items = [food({ id: 'a', name: 'Dal' })]
    expect(suggestMeals(items, gap(MIN_USEFUL_KCAL - 1))).toEqual([])
    expect(suggestMeals(items, gap(0))).toEqual([])
    expect(suggestMeals(items, gap(-500))).toEqual([])
  })

  it('never suggests a dish that would eat the whole remaining budget', () => {
    // 600 kcal left, ceiling is 510. A 560 kcal serving must not appear.
    const big = food({ id: 'big', name: 'Biryani', kcal_per_100g: 560 })
    expect(suggestMeals([big], gap(600))).toEqual([])
    expect(MAX_GAP_SHARE).toBeLessThan(1)
  })

  it('skips rows with no calories — broken data or water, not a meal', () => {
    expect(suggestMeals([food({ id: 'z', name: 'Water', kcal_per_100g: 0 })], gap(600))).toEqual([])
  })

  it('never re-offers a dish the user swiped away', () => {
    const items = [food({ id: 'a', name: 'Dal' }), food({ id: 'b', name: 'Idli' })]
    const out = suggestMeals(items, gap(600), { dismissedIds: ['a'] })
    expect(out.map((s) => s.food.id)).toEqual(['b'])
  })
})

describe('suggestMeals — ranking', () => {
  it('prefers the dish that fills more of the gap', () => {
    const small = food({ id: 'small', name: 'Small', kcal_per_100g: 60 })
    const good  = food({ id: 'good',  name: 'Good',  kcal_per_100g: 400 })
    const out = suggestMeals([small, good], gap(600))
    expect(out[0].food.id).toBe('good')
  })

  it('prefers protein when two dishes fit equally', () => {
    const lean = food({ id: 'lean', name: 'Lean', kcal_per_100g: 300, protein_g_per_100g: 30 })
    const carby = food({ id: 'carby', name: 'Carby', kcal_per_100g: 300, protein_g_per_100g: 3 })
    const out = suggestMeals([lean, carby], gap(600, 60))
    expect(out[0].food.id).toBe('lean')
  })

  it('lets a measured row beat a curated estimate of equal fit', () => {
    // Same numbers, different provenance — the measured one must win.
    const measured = food({ id: 'm', name: 'Rajma', source: 'ifct' })
    const estimate = food({ id: 'e', name: 'Rajma', source: 'curated' })
    const out = suggestMeals([estimate, measured], gap(600))
    expect(out[0].food.id).toBe('m')
  })

  it('flags curated rows as estimates so the UI can badge them', () => {
    const out = suggestMeals([
      food({ id: 'e', name: 'Something', source: 'curated' }),
      food({ id: 'm', name: 'Other', source: 'ifct' }),
    ], gap(600))
    expect(out.find((s) => s.food.id === 'e')!.isEstimate).toBe(true)
    expect(out.find((s) => s.food.id === 'm')!.isEstimate).toBe(false)
  })

  it('is deterministic — identical input, identical order', () => {
    const items = [
      food({ id: 'a', name: 'Aloo' }), food({ id: 'b', name: 'Bhindi' }),
      food({ id: 'c', name: 'Chana' }), food({ id: 'd', name: 'Dal' }),
    ]
    const first = suggestMeals(items, gap(600)).map((s) => s.food.id)
    const second = suggestMeals([...items].reverse(), gap(600)).map((s) => s.food.id)
    expect(first).toEqual(second)
  })

  it('respects the limit', () => {
    const many = Array.from({ length: 40 }, (_, i) => food({ id: `f${i}`, name: `Food ${i}` }))
    expect(suggestMeals(many, gap(600), { limit: 5 })).toHaveLength(5)
  })
})

describe('suggestMeals — the numbers it reports', () => {
  it('reports the serving it actually suggested, not per-100g figures', () => {
    const roti = food({
      id: 'roti', name: 'Roti', kcal_per_100g: 300, protein_g_per_100g: 10,
      common_portions: [{ unit: 'piece', grams: 40, label: '1 roti' }],
    })
    const [s] = suggestMeals([roti], gap(600))
    expect(s.grams).toBe(40)
    expect(s.kcal).toBe(120)
    expect(s.proteinG).toBe(4)
  })

  it('scores between 0 and 1 so the UI can be honest about weak matches', () => {
    const out = suggestMeals([
      food({ id: 'a', name: 'A', kcal_per_100g: 400 }),
      food({ id: 'b', name: 'B', kcal_per_100g: 90 }),
    ], gap(600, 40))
    for (const s of out) {
      expect(s.score).toBeGreaterThan(0)
      expect(s.score).toBeLessThanOrEqual(1)
    }
  })

  it('still ranks sensibly with no protein target set', () => {
    const out = suggestMeals([
      food({ id: 'lo', name: 'Lo', kcal_per_100g: 300, protein_g_per_100g: 2 }),
      food({ id: 'hi', name: 'Hi', kcal_per_100g: 300, protein_g_per_100g: 25 }),
    ], gap(600, 0))
    expect(out[0].food.id).toBe('hi')
  })
})
