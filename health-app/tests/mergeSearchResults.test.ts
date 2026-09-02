import { describe, it, expect } from 'vitest'
import {
  collapseDuplicateFoods,
  capOpenFoodFactsDominance,
  dropForeignWhenIndianExists,
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
    // query like "boiled egg", the default 10 for a brand-named one.
    const rows = Array.from({ length: 6 }, (_, i) => food({ name: `Off ${i}`, source: 'off' }))
    const tight = capOpenFoodFactsDominance(rows, 3)
    expect(tight.slice(0, 3).map((f) => f.name)).toEqual(['Off 0', 'Off 1', 'Off 2'])
    const loose = capOpenFoodFactsDominance(rows, 10)
    expect(loose.map((f) => f.name)).toEqual(rows.map((f) => f.name))
  })
})

describe('dropForeignWhenIndianExists', () => {
  // `lib/open-food-facts.ts` prefixes by endpoint: `offi_` = listed as sold in
  // India, `off_` = world only. After `offToExternal` flattens `source` to
  // 'off' for both, the prefix is the only surviving signal.
  const indianPacket = (name: string, brand: string) =>
    food({ name, brand, source: 'off', source_id: `offi_${name}` })
  const foreignPacket = (name: string, brand: string) =>
    food({ name, brand, source: 'off', source_id: `off_${name}` })

  it('hides foreign supermarket rows once an Indian row answers the query', () => {
    // The live "boiled egg" screen: one Indian answer, five foreign own-brands,
    // all rendered as identical cards with no way to tell which to pick.
    const rows = [
      food({ name: 'Boiled Egg (Anda)', source: 'ifct', source_id: 'ifct-egg-boiled' }),
      foreignPacket('Boiled egg', 'CP'),
      foreignPacket('Boiled Eggs', 'Bili Bili'),
      foreignPacket('2 hard boiled eggs', 'Morrisons'),
      foreignPacket('Organic Hard Boiled Eggs', 'Vital Farms'),
      foreignPacket('Free range hard boiled eggs', 'Co-op'),
    ]
    const result = dropForeignWhenIndianExists(rows, 'boiled egg')
    expect(result.map((f) => f.name)).toEqual(['Boiled Egg (Anda)'])
  })

  it('keeps foreign rows when nothing Indian matched — an empty screen is worse', () => {
    const rows = [
      foreignPacket('Marmite Yeast Extract', 'Marmite'),
      foreignPacket('Vegemite', 'Vegemite'),
    ]
    const result = dropForeignWhenIndianExists(rows, 'marmite')
    expect(result).toHaveLength(2)
  })

  it('never drops an Open Food Facts row listed as sold in India', () => {
    const rows = [
      food({ name: 'Butter', source: 'ifct', source_id: 'ifct-butter' }),
      indianPacket('Amul Butter', 'Amul'),
      foreignPacket('Kerrygold Butter', 'Kerrygold'),
    ]
    const result = dropForeignWhenIndianExists(rows, 'butter')
    expect(result.map((f) => f.name)).toEqual(['Butter', 'Amul Butter'])
  })

  it('treats every non-Open-Food-Facts source as an Indian answer', () => {
    for (const source of ['ifct', 'curated', 'branded', 'restaurant', 'user'] as const) {
      const rows = [
        food({ name: 'Something', source, source_id: `${source}-something` }),
        foreignPacket('Foreign Thing', 'Tesco'),
      ]
      const result = dropForeignWhenIndianExists(rows, 'something')
      expect(result.map((f) => f.name), source).toEqual(['Something'])
    }
  })

  it('keeps a foreign row when the query names its brand', () => {
    const rows = [
      food({ name: 'Baked Beans', source: 'curated', source_id: 'est-baked-beans' }),
      foreignPacket('Baked Beans', 'Tesco'),
    ]
    const result = dropForeignWhenIndianExists(rows, 'tesco baked beans')
    expect(result).toHaveLength(2)
  })

  it('leaves a list of purely Indian rows untouched', () => {
    const rows = [
      food({ name: 'Cooked Rice (Chawal)', source: 'ifct', source_id: 'ifct-rice' }),
      food({ name: 'Jeera Rice', source: 'curated', source_id: 'est-jeera-rice' }),
    ]
    expect(dropForeignWhenIndianExists(rows, 'rice')).toHaveLength(2)
  })

  it('keeps an OFF row with no source_id — absent provenance is not proof of foreign', () => {
    // `Food.source_id` is nullable. A row that cannot be shown to be foreign is
    // kept, matching the "an empty screen is worse" bias everywhere else here.
    const rows = [
      food({ name: 'Poha', source: 'ifct', source_id: 'ifct-poha' }),
      food({ name: 'Mystery Packet', source: 'off', source_id: null }),
    ]
    const result = dropForeignWhenIndianExists(rows, 'poha')
    expect(result.map((f) => f.name)).toEqual(['Poha', 'Mystery Packet'])
  })

  it('handles an empty list', () => {
    expect(dropForeignWhenIndianExists([], 'anything')).toEqual([])
  })
})
