import { describe, it, expect } from 'vitest'
import { dedupeFoodsByNameBrand, capOpenFoodFactsDominance } from '../lib/mergeSearchResults'
import type { Food } from '../types/index'

// Minimal Food factory — only the fields dedupe reads matter.
function food(partial: Partial<Food> & { name: string }): Food {
  return {
    id: partial.id ?? Math.random().toString(36).slice(2),
    source: partial.source ?? 'ifct',
    source_id: partial.source_id ?? partial.name,
    name: partial.name,
    brand: partial.brand ?? null,
    serving_size_g: 100,
    serving_description: '100 g',
    kcal_per_100g: 100,
    protein_g_per_100g: 5,
    carbs_g_per_100g: 20,
    fat_g_per_100g: 3,
    fiber_g_per_100g: null,
    common_portions: null,
  } as unknown as Food
}

describe('dedupeFoodsByNameBrand', () => {
  it('surfaces a personal estimate when there is no name collision (re-find a scan)', () => {
    const global = [food({ name: 'Roti', source: 'ifct' })]
    const mine = [food({ name: "Amma's Special Thali", source: 'estimate' })]
    const result = dedupeFoodsByNameBrand([...global, ...mine])
    expect(result.map((f) => f.name)).toContain("Amma's Special Thali")
  })

  it('lets the global row win a name+brand collision (accurate IFCT beats an estimate)', () => {
    const global = [food({ name: 'Aloo Paratha', source: 'ifct' })]
    const mine = [food({ name: 'aloo paratha', source: 'estimate' })]
    const result = dedupeFoodsByNameBrand([...global, ...mine])
    const alooRows = result.filter((f) => f.name.toLowerCase() === 'aloo paratha')
    expect(alooRows).toHaveLength(1)
    expect(alooRows[0].source).toBe('ifct')
  })

  it('treats same name with different brands as distinct', () => {
    const result = dedupeFoodsByNameBrand([
      food({ name: 'Chips', brand: 'Lays' }),
      food({ name: 'Chips', brand: 'Bingo' }),
    ])
    expect(result).toHaveLength(2)
  })

  it('caps the result at the given limit', () => {
    const many = Array.from({ length: 30 }, (_, i) => food({ name: `Food ${i}` }))
    expect(dedupeFoodsByNameBrand(many, 20)).toHaveLength(20)
  })
})

describe('capOpenFoodFactsDominance', () => {
  it('leaves a list alone when OFF is under the cap', () => {
    const rows = [
      food({ name: 'Cornflakes', source: 'off' }),
      food({ name: 'Bhutta (Roasted Corn)', source: 'curated' }),
    ]
    expect(capOpenFoodFactsDominance(rows, 10).map((f) => f.name)).toEqual([
      'Cornflakes',
      'Bhutta (Roasted Corn)',
    ])
  })

  it('lets an Indian food through when OFF would have filled the whole page', () => {
    // The real "corn" case: 20 cornflakes variants accumulated in `foods`, all
    // outranking a roasted corn cob, which then fell past the 20-row cap.
    const rows = [
      ...Array.from({ length: 25 }, (_, i) => food({ name: `Corn Flakes ${i}`, source: 'off' })),
      food({ name: 'Bhutta (Roasted Corn)', source: 'curated' }),
    ]
    const capped = capOpenFoodFactsDominance(rows, 10)
    const visible = dedupeFoodsByNameBrand(capped, 20).map((f) => f.name)
    expect(visible).toContain('Bhutta (Roasted Corn)')
  })

  it('counts every OFF flavour against one shared budget', () => {
    const rows = [
      ...Array.from({ length: 3 }, (_, i) => food({ name: `A${i}`, source: 'off_india' })),
      ...Array.from({ length: 3 }, (_, i) => food({ name: `B${i}`, source: 'off_world' })),
      food({ name: 'Bhutta', source: 'curated' }),
    ]
    const capped = capOpenFoodFactsDominance(rows, 4)
    expect(capped.slice(0, 5).map((f) => f.name)).toEqual(['A0', 'A1', 'A2', 'B0', 'Bhutta'])
  })

  it('demotes surplus rows rather than discarding them', () => {
    const rows = Array.from({ length: 6 }, (_, i) => food({ name: `Off ${i}`, source: 'off' }))
    const capped = capOpenFoodFactsDominance(rows, 2)
    expect(capped).toHaveLength(6)
    expect(capped.map((f) => f.name)).toEqual(['Off 0', 'Off 1', 'Off 2', 'Off 3', 'Off 4', 'Off 5'])
  })

  it('never demotes a measured IFCT row', () => {
    const rows = [
      ...Array.from({ length: 12 }, (_, i) => food({ name: `Off ${i}`, source: 'off' })),
      food({ name: 'Sweet Corn (Makkai)', source: 'ifct' }),
    ]
    const capped = capOpenFoodFactsDominance(rows, 5)
    expect(capped[5].name).toBe('Sweet Corn (Makkai)')
  })
})
