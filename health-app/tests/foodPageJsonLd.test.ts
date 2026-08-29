import { describe, it, expect } from 'vitest'
import { buildFoodJsonLd } from '../lib/foodPageCopy'

const POHA = {
  name: 'Poha',
  kcal_per_100g: 130.4,
  protein_g_per_100g: 2.6,
  carbs_g_per_100g: 27.1,
  fat_g_per_100g: 1.4,
  fiber_g_per_100g: 1.8,
}

describe('buildFoodJsonLd', () => {
  it('is a valid schema.org Product node, not a Recipe', () => {
    const ld = buildFoodJsonLd(POHA)
    expect(ld['@context']).toBe('https://schema.org')
    expect(ld['@type']).toBe('Product')
    expect(ld.name).toBe('Poha')
  })

  it('carries a NutritionInformation block with rounded per-100g macros', () => {
    const n = buildFoodJsonLd(POHA).nutrition as Record<string, string>
    expect(n['@type']).toBe('NutritionInformation')
    expect(n.servingSize).toBe('100 g')
    expect(n.calories).toBe('130 kcal')
    expect(n.proteinContent).toBe('3 g')
    expect(n.carbohydrateContent).toBe('27 g')
    expect(n.fatContent).toBe('1 g')
    expect(n.fiberContent).toBe('2 g')
  })

  it('omits fiber when the row has none, and omits brand when absent', () => {
    const ld = buildFoodJsonLd({ ...POHA, fiber_g_per_100g: null })
    expect((ld.nutrition as Record<string, string>).fiberContent).toBeUndefined()
    expect(ld.brand).toBeUndefined()
  })

  it('includes a brand node when the food has one', () => {
    const ld = buildFoodJsonLd({ ...POHA, brand: 'MTR' })
    expect(ld.brand).toEqual({ '@type': 'Brand', name: 'MTR' })
  })

  it('serializes to valid JSON (it goes into a <script> tag)', () => {
    expect(() => JSON.parse(JSON.stringify(buildFoodJsonLd(POHA)))).not.toThrow()
  })
})
