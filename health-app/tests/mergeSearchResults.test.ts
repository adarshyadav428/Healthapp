import { describe, it, expect } from 'vitest'
import {
  collapseDuplicateFoods,
  capOpenFoodFactsDominance,
  MAX_SEARCH_RESULTS,
} from '../lib/mergeSearchResults'
import { SOURCE_RANK } from '../lib/foodMatch'
import type { Food } from '../types/index'

// Minimal Food factory — only the fields dedupe/collapse read matter.
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

describe('collapseDuplicateFoods', () => {
  it('collapses the boiled egg cluster to the measured IFCT row', () => {
    // The live bug this fixes: three "boiled egg" rows at three different
    // kcal figures (curated 108, ifct 173, off 140), badged by source and
    // left for the user to arbitrate. SOURCE_RANK already has an answer.
    const rows = [
      food({ name: 'Boiled Egg', source: 'curated' }),
      food({ name: 'Boiled Egg (Anda)', source: 'ifct' }),
      food({ name: 'Boiled egg', source: 'off' }),
    ]
    const result = collapseDuplicateFoods(rows, SOURCE_RANK)
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('ifct')
  })

  it('never collapses two genuinely different foods', () => {
    const rows = [food({ name: 'Boiled Egg' }), food({ name: 'Egg White' })]
    const result = collapseDuplicateFoods(rows, SOURCE_RANK)
    expect(result.map((f) => f.name)).toEqual(['Boiled Egg', 'Egg White'])
  })

  it('never collapses a branded row into a brandless one', () => {
    const rows = [food({ name: 'Butter' }), food({ name: 'Amul Butter', brand: 'Amul' })]
    const result = collapseDuplicateFoods(rows, SOURCE_RANK)
    expect(result).toHaveLength(2)
  })

  it('never collapses two different brands of the same food', () => {
    const rows = [
      food({ name: 'Chips', brand: 'Lays' }),
      food({ name: 'Chips', brand: 'Bingo' }),
    ]
    const result = collapseDuplicateFoods(rows, SOURCE_RANK)
    expect(result).toHaveLength(2)
  })

  it('surfaces a personal estimate when there is no name collision (re-find a scan)', () => {
    const global = [food({ name: 'Roti', source: 'ifct' })]
    const mine = [food({ name: "Amma's Special Thali", source: 'estimate' })]
    const result = collapseDuplicateFoods([...global, ...mine], SOURCE_RANK)
    expect(result.map((f) => f.name)).toContain("Amma's Special Thali")
  })

  it('lets the global row win a name collision over a personal estimate', () => {
    const global = [food({ name: 'Aloo Paratha', source: 'ifct' })]
    const mine = [food({ name: 'aloo paratha', source: 'estimate' })]
    const result = collapseDuplicateFoods([...global, ...mine], SOURCE_RANK)
    const alooRows = result.filter((f) => f.name.toLowerCase() === 'aloo paratha')
    expect(alooRows).toHaveLength(1)
    expect(alooRows[0].source).toBe('ifct')
  })

  it('elects the winner regardless of which cluster member sorted first', () => {
    // The estimate is listed first (as it would be if it won the exact-name
    // relevance tier before SOURCE_RANK was ever consulted) — the winner
    // must still be the measured row.
    const rows = [
      food({ name: 'Boiled Egg', source: 'curated' }),
      food({ name: 'Boiled Egg (Anda)', source: 'ifct' }),
    ]
    const result = collapseDuplicateFoods(rows, SOURCE_RANK)
    expect(result).toHaveLength(1)
    expect(result[0].source).toBe('ifct')
  })

  it('emits the winner at the position of the cluster\'s first occurrence', () => {
    const rows = [
      food({ name: 'Roti', source: 'ifct' }),
      food({ name: 'Boiled Egg', source: 'curated' }),
      food({ name: 'Rice', source: 'ifct' }),
      food({ name: 'Boiled Egg (Anda)', source: 'ifct' }),
    ]
    const result = collapseDuplicateFoods(rows, SOURCE_RANK)
    expect(result.map((f) => f.name)).toEqual(['Roti', 'Boiled Egg (Anda)', 'Rice'])
  })

  it('caps the result at the given limit', () => {
    const many = Array.from({ length: 30 }, (_, i) => food({ name: `Food ${i}` }))
    expect(collapseDuplicateFoods(many, SOURCE_RANK, 20)).toHaveLength(20)
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
    const visible = collapseDuplicateFoods(capped, SOURCE_RANK, MAX_SEARCH_RESULTS).map((f) => f.name)
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

  it('applies a tighter cap for a query naming no brand, a looser one when it does', () => {
    // Mirrors how the route calls this: MAX_OFF_WITHOUT_BRAND (3) for a plain
    // query like "boiled egg", the default 10 for a brand-named one. Neither
    // call here passes `drop`, so both still demote rather than discard —
    // this pins the cap number alone, not the drop behaviour below.
    const rows = Array.from({ length: 6 }, (_, i) => food({ name: `Off ${i}`, source: 'off' }))
    const tight = capOpenFoodFactsDominance(rows, 3)
    expect(tight.slice(0, 3).map((f) => f.name)).toEqual(['Off 0', 'Off 1', 'Off 2'])
    const loose = capOpenFoodFactsDominance(rows, 10)
    expect(loose.map((f) => f.name)).toEqual(rows.map((f) => f.name))
  })

  it('drop: true removes surplus rows instead of demoting them', () => {
    // The actual bug this fixes: demoting-not-dropping is a no-op whenever
    // the total candidate count is under the 20-row response limit, which is
    // exactly the "boiled egg" case — one Indian answer plus a handful of
    // foreign packaged eggs, nowhere near 20 total. Demoting left every OFF
    // row still in the response, just reordered; a cap only a user can
    // actually see needs to discard, not reorder, once candidates are few.
    const rows = Array.from({ length: 6 }, (_, i) => food({ name: `Off ${i}`, source: 'off' }))
    const dropped = capOpenFoodFactsDominance(rows, 3, { drop: true })
    expect(dropped.map((f) => f.name)).toEqual(['Off 0', 'Off 1', 'Off 2'])
  })

  it('drop: true never removes a non-OFF row, only surplus OFF ones', () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => food({ name: `Off ${i}`, source: 'off' })),
      food({ name: 'Sweet Corn (Makkai)', source: 'ifct' }),
    ]
    const dropped = capOpenFoodFactsDominance(rows, 2, { drop: true })
    expect(dropped.map((f) => f.name)).toEqual(['Off 0', 'Off 1', 'Sweet Corn (Makkai)'])
  })
})
