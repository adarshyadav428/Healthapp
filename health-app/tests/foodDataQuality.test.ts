import { describe, it, expect } from 'vitest'
import { INDIAN_FOODS } from '../lib/indian-foods-data'
import { CURATED_FOODS } from '../lib/curated-foods-data'
import { foodClusterKey } from '../lib/foodClusterKey'

/**
 * Guardrails for whether the seed catalogue is *accurate*, not just present.
 *
 * `collapseDuplicateFoods` (lib/mergeSearchResults.ts) now hard-collapses
 * every cluster of same-food rows down to one at search time, and
 * `FoodResult.tsx` no longer badges the survivor by source — so a wrong
 * number in the surviving row is no longer visible as a spread the user could
 * notice and cross-check. This is the check that has to hold instead.
 *
 * Named "boiled egg": a curated row at 108 kcal/100g, a measured IFCT row
 * that read 173 (an internal bug — its fat field had been copied from its
 * protein field, so Atwater self-consistency alone could not have caught it;
 * see the correction below), and an Open Food Facts row at 140. The real
 * figure, read off IFCT 2017 (`nodef/ifct2017`, code M004, "Egg, poultry,
 * whole, boiled": 618 kJ ÷ 4.184 ≈ 148 kcal, protein 13.43 g, fat 10.54 g),
 * is closest to none of the three shipped values. Corrected in
 * `supabase/migrations/043_correct_duplicate_cluster_rows.sql`.
 */
describe('food catalogue data quality', () => {
  it('agrees with itself within 20% inside every duplicate cluster', () => {
    // Only the datasets we ship as static seeds — not live OFF/branded rows,
    // which this test cannot see and which collapseDuplicateFoods handles at
    // request time regardless of what this catalogue looks like.
    const all = [...INDIAN_FOODS, ...CURATED_FOODS]
    const byCluster = new Map<string, typeof all>()
    for (const food of all) {
      const key = foodClusterKey(food)
      const bucket = byCluster.get(key)
      if (bucket) bucket.push(food)
      else byCluster.set(key, [food])
    }

    const offenders: string[] = []
    for (const [key, members] of byCluster) {
      if (members.length < 2) continue
      const kcals = members.map((f) => f.kcal_per_100g)
      const spread = (Math.max(...kcals) - Math.min(...kcals)) / Math.min(...kcals)
      if (spread > 0.2) {
        offenders.push(
          `${key}: ${members.map((f) => `${f.name} [${f.source}] ${f.kcal_per_100g}kcal`).join(' vs ')}`
        )
      }
    }
    expect(offenders).toEqual([])
  })

  // Deliberately no Atwater-consistency check for INDIAN_FOODS (contrast
  // tests/curatedFoods.test.ts, which does check the *generated* curated
  // rows to <1 kcal because their kcal is computed by that same 4/4/9 formula
  // by construction). Measured IFCT energy comes from IFCT's own published
  // figure, derived with food-specific conversion factors, not a generic
  // Atwater formula — a real per-100g measurement legitimately sits some way
  // off 4P+4C+9F, so scoring hand-entered measured rows against it produced
  // ~80 false positives here on a first pass, none of them real errors. It
  // also would not have caught the boiled-egg bug this file exists for: that
  // row's fat had been copied from its protein, so its stated kcal WAS
  // Atwater-consistent with its (wrong) macros. There is no code invariant
  // that catches "internally consistent but wrong" — only checking against
  // the source does, which is why the correction below cites IFCT 2017
  // directly rather than deriving a replacement value.

  it('never lets a curated estimate share a cluster with a measured IFCT row', () => {
    // Belt-and-suspenders on top of the CURATED_FOODS filter itself
    // (lib/curated-foods-data.ts) — this is the invariant that filter exists
    // to hold, checked independently so a regression there fails loudly here.
    const ifctKeys = new Set(INDIAN_FOODS.map((f) => foodClusterKey(f)))
    const offenders = CURATED_FOODS.filter((f) => ifctKeys.has(foodClusterKey(f))).map((f) => f.name)
    expect(offenders).toEqual([])
  })
})
