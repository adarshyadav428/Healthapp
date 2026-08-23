import { describe, it, expect } from 'vitest'
import type { Food } from '../types/index'
import {
  buildUnits,
  pickDefaultUnit,
  inferPortionSelection,
  defaultPortionFor,
  FALLBACK_SERVING_G,
  SMART_PORTIONS,
} from '../lib/portion-units'

function makeFood(over: Partial<Food> = {}): Food {
  return {
    id: 'f1',
    source: 'ifct',
    source_id: null,
    name: 'Test food',
    brand: null,
    serving_size_g: 100,
    serving_description: '100g',
    kcal_per_100g: 134,
    protein_g_per_100g: 2.4,
    carbs_g_per_100g: 30.5,
    fat_g_per_100g: 0.4,
    fiber_g_per_100g: null,
    common_portions: null,
    ...over,
  }
}

describe('buildUnits', () => {
  it('offers grams first and never offers ounces (India-first app)', () => {
    const units = buildUnits(makeFood({ name: 'Unknown mystery dish' }))
    expect(units[0].key).toBe('g')
    expect(units[0].toGrams(180)).toBe(180)
    expect(units.some((u) => u.key === 'oz')).toBe(false)
  })

  it('smart-matches cooked rice to katori/plate portions', () => {
    const units = buildUnits(makeFood({ name: 'Cooked Rice (Chawal)' }))
    const labels = units.map((u) => u.label)
    expect(labels).toContain('1 katori cooked (150g)')
    expect(labels).toContain('1 plate (250g)')
    const katori = units.find((u) => u.key === 'katori')!
    expect(katori.toGrams(2)).toBe(300)
  })

  it('smart match takes precedence over common_portions', () => {
    const units = buildUnits(
      makeFood({
        name: 'Dal Tadka',
        common_portions: [{ unit: 'katori', grams: 999, label: 'DB katori (999g)' }],
      })
    )
    expect(units.some((u) => u.label === 'DB katori (999g)')).toBe(false)
    expect(units.some((u) => u.label === '1 bowl (250ml)')).toBe(true)
  })

  it('falls back to common_portions when no smart match', () => {
    const units = buildUnits(
      makeFood({
        name: 'Zzz obscure dish',
        common_portions: [
          { unit: 'katori', grams: 150, label: '1 katori (150g)' },
          { unit: 'gram', grams: 100, label: '100g' },
        ],
      })
    )
    expect(units.some((u) => u.label === '1 katori (150g)')).toBe(true)
    // gram-unit entries from the DB are skipped (grams is always offered anyway)
    expect(units.filter((u) => u.key === 'g')).toHaveLength(1)
  })

  it('falls back to serving_size_g only when it is a real serving (≠100g)', () => {
    const withServing = buildUnits(makeFood({ name: 'Zzz obscure dish', serving_size_g: 180, serving_description: '1 katori (180g)' }))
    expect(withServing.some((u) => u.key === 'serving' && u.toGrams(1) === 180)).toBe(true)

    const default100 = buildUnits(makeFood({ name: 'Zzz obscure dish', serving_size_g: 100 }))
    expect(default100.some((u) => u.key === 'serving')).toBe(false)
  })
})

describe('pickDefaultUnit', () => {
  it('uses the smart entry default (large egg, katori rice)', () => {
    const eggUnits = buildUnits(makeFood({ name: 'Egg, whole, boiled' }))
    expect(pickDefaultUnit(eggUnits, makeFood({ name: 'Egg, whole, boiled' })).label).toBe('Large egg (50g)')

    const riceFood = makeFood({ name: 'Cooked Rice (Chawal)' })
    expect(pickDefaultUnit(buildUnits(riceFood), riceFood).key).toBe('katori')
  })

  it('falls back to first non-gram unit, then grams', () => {
    const food = makeFood({ name: 'Zzz obscure dish', serving_size_g: 180 })
    expect(pickDefaultUnit(buildUnits(food), food).key).toBe('serving')

    const bare = makeFood({ name: 'Zzz obscure dish' })
    expect(pickDefaultUnit(buildUnits(bare), bare).key).toBe('g')
  })
})

describe('chaat / spread pattern fixes', () => {
  it('pani puri no longer matches the single-puri portions', () => {
    const units = buildUnits(makeFood({ name: 'Pani Puri' }))
    expect(units.some((u) => u.label.includes('pieces with pani'))).toBe(true)
    expect(units.some((u) => u.label === '1 puri (25g)')).toBe(false)
  })

  it('bhel puri matches the bhel plate, not a 25g puri', () => {
    const food = makeFood({ name: 'Bhel Puri' })
    const def = pickDefaultUnit(buildUnits(food), food)
    expect(def.toGrams(1)).toBe(150)
  })

  it('peanut butter gets spoon portions, not the ghee/butter or peanut-handful buckets', () => {
    const food = makeFood({ name: 'Peanut Butter (crunchy)' })
    const def = pickDefaultUnit(buildUnits(food), food)
    expect(def.label).toBe('1 tbsp (16g)')
  })
})

describe('bowl / glass coverage', () => {
  it.each([
    ['Dal Makhani', '1 bowl (250ml)'],
    ['Tomato Soup', '1 bowl (250ml)'],
    ['Curd (Dahi)', '1 bowl (250g)'],
    ['Coconut Water (Nariyal Pani)', '1 glass (200ml)'],
    ['Mango Milkshake', '1 glass (250ml)'],
    ['Sweet Lassi', '1 glass (200ml)'],
  ])('%s offers "%s"', (name, expected) => {
    const units = buildUnits(makeFood({ name }))
    expect(units.map((u) => u.label)).toContain(expected)
  })
})

describe('inferPortionSelection', () => {
  const rice = makeFood({ name: 'Cooked Rice (Chawal)' })

  it('expresses clean gram totals as household units', () => {
    const units = buildUnits(rice)
    const sel = inferPortionSelection(units, 150)
    expect(sel.unit.key).toBe('katori')
    expect(sel.quantity).toBe(1)
  })

  it('prefers whole counts: 80g idli → 1 × "2 idlis"', () => {
    const units = buildUnits(makeFood({ name: 'Idli' }))
    const sel = inferPortionSelection(units, 80)
    expect(sel.unit.toGrams(sel.quantity)).toBe(80)
    expect(Number.isInteger(sel.quantity)).toBe(true)
  })

  it('supports half portions (75g rice → 0.5 katori)', () => {
    const units = buildUnits(rice)
    const sel = inferPortionSelection(units, 75)
    expect(sel.unit.key).toBe('katori')
    expect(sel.quantity).toBe(0.5)
  })

  it('falls back to grams for irregular amounts (the 180g screenshot case)', () => {
    const units = buildUnits(rice)
    const sel = inferPortionSelection(units, 180)
    expect(sel.unit.key).toBe('g')
    expect(sel.quantity).toBe(180)
  })

  it('never returns a unit whose grams misrepresent the stored total by >2%', () => {
    for (const grams of [37, 111, 265, 999]) {
      const sel = inferPortionSelection(buildUnits(rice), grams)
      expect(Math.abs(sel.unit.toGrams(sel.quantity) - grams)).toBeLessThanOrEqual(Math.max(2, grams * 0.02))
    }
  })
})

describe('SMART_PORTIONS table sanity', () => {
  it('every entry has a resolvable defaultKey and positive gram weights', () => {
    for (const entry of SMART_PORTIONS) {
      expect(entry.portions.some((p) => p.key === entry.defaultKey)).toBe(true)
      for (const p of entry.portions) {
        expect(p.grams).toBeGreaterThan(0)
        expect(p.label.length).toBeGreaterThan(0)
      }
      const keys = entry.portions.map((p) => p.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
  })

  /**
   * A packet of fried moong dal namkeen is not a katori of dal. `SMART_PORTIONS`
   * is scanned with `.find`, so the first pattern in declaration order wins —
   * and the dal rule used to sit above the snack rule, which meant
   * "Moong Dal Namkeen" pre-selected a 200 g katori. At 476 kcal/100 g that is
   * ~952 kcal on tap-through, where the pack is 30 g (~143). The rename in
   * migration 037 did not reach this: it fires *after* the user has already
   * picked the right food.
   */
  it('a namkeen packet is measured in packs, not katoris', () => {
    const firstMatch = (name: string) => SMART_PORTIONS.find((e) => e.pattern.test(name))!
    for (const name of ['Moong Dal Namkeen', 'Balaji Wafers Chana Dal', 'Dal Bhujia']) {
      const entry = firstMatch(name)
      const def = entry.portions.find((p) => p.key === entry.defaultKey)!
      expect(def.grams, name).toBeLessThanOrEqual(40)
    }
  })

  it('a cooked dal still gets its katori', () => {
    const firstMatch = (name: string) => SMART_PORTIONS.find((e) => e.pattern.test(name))!
    for (const name of ['Moong Dal (Yellow)', 'Dal Tadka', 'Sambar (South Indian Dal)', 'Masoor Dal']) {
      const entry = firstMatch(name)
      const def = entry.portions.find((p) => p.key === entry.defaultKey)!
      expect(def.grams, name).toBe(200)
    }
  })

  it('picks the pack default end-to-end for a renamed namkeen row', () => {
    const namkeen = makeFood({ name: 'Moong Dal Namkeen', source: 'off', brand: "Haldiram's" })
    expect(pickDefaultUnit(buildUnits(namkeen), namkeen).toGrams(1)).toBe(30)
    const dal = makeFood({ name: 'Moong Dal (Yellow)' })
    expect(pickDefaultUnit(buildUnits(dal), dal).toGrams(1)).toBe(200)
  })

  it('specific dishes win over generic ingredients (ordering guard)', () => {
    const firstMatch = (name: string) => SMART_PORTIONS.find((e) => e.pattern.test(name))!
    expect(firstMatch('Pav Bhaji').portions[0].grams).toBe(280) // not 40g pav
    expect(firstMatch('Pani Puri').portions[0].grams).toBe(90)  // not 25g puri
    expect(firstMatch('Chicken Biryani').portions.some((p) => p.label.includes('plate'))).toBe(true) // biryani, not chicken curry
  })
})

describe('defaultPortionFor — the one answer both log buttons use', () => {
  // The "+" pill on a search row and the amount AddFoodModal opens on used to
  // be computed independently: quickAdd read food.serving_size_g while the
  // modal used SMART_PORTIONS. Two adjacent buttons therefore logged different
  // amounts of the same food, with no way for the user to tell.
  it('agrees with the modal rather than with serving_size_g', () => {
    const rice = makeFood({ name: 'Cooked Rice (Chawal)', serving_size_g: 180 })
    const units = buildUnits(rice)
    const portion = defaultPortionFor(rice, units)

    // What the modal opens on…
    expect(portion.unit.key).toBe(pickDefaultUnit(units, rice).key)
    expect(portion.grams).toBe(portion.unit.toGrams(portion.quantity))
    // …which is a katori, not the row's 180 g serving size.
    expect(portion.grams).toBe(150)
    expect(portion.grams).not.toBe(rice.serving_size_g)
  })

  it('opens on one of a household measure where the food has one', () => {
    const roti = makeFood({ name: 'Chapati / Roti' })
    expect(defaultPortionFor(roti).quantity).toBe(1)
  })

  it('never opens a grams-only food on 1 gram', () => {
    // An Open Food Facts row whose serving string did not parse: the route
    // stores serving_size_g = 100, buildUnits then offers grams alone, and the
    // modal used to seed quantity from the literal '1'.
    const packaged = makeFood({ name: 'Zzz obscure packaged thing', serving_size_g: 100 })
    const portion = defaultPortionFor(packaged)
    expect(portion.unit.key).toBe('g')
    expect(portion.quantity).toBe(100)
    expect(portion.grams).toBe(100)
  })

  it('falls back to a real amount rather than logging zero grams', () => {
    const noServing = makeFood({ name: 'Zzz obscure packaged thing', serving_size_g: 0 })
    const portion = defaultPortionFor(noServing)
    expect(portion.grams).toBe(FALLBACK_SERVING_G)
    expect(portion.grams).toBeGreaterThan(0)
  })

  it('uses a real single serving when the row carries one', () => {
    const pack = makeFood({ name: 'Zzz obscure packaged thing', serving_size_g: 30 })
    const portion = defaultPortionFor(pack)
    expect(portion.grams).toBe(30)
    expect(portion.quantity).toBe(1)
  })
})
