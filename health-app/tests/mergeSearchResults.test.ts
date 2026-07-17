import { describe, it, expect } from 'vitest'
import { dedupeFoodsByNameBrand } from '../lib/mergeSearchResults'
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
