import type { Food } from '../types/index'
import { foodClusterKey } from './foodClusterKey'
import { queryNamesBrand } from './searchRanking'

/** Open Food Facts rows, wherever they came from — live fetch or cached in `foods`. */
const OFF_SOURCES = new Set(['off', 'off_india', 'off_world'])

/**
 * Push surplus Open Food Facts rows behind everything else, preserving the
 * order within each group.
 *
 * Every OFF row we ever show is written into the `foods` table, so over time a
 * popular query accumulates dozens of near-identical packaged products that then
 * compete in the *local* ranking. Searching "corn" returned twenty cornflakes
 * variants — including Spanish-labelled ones — and pushed "Bhutta (Roasted
 * Corn)" off the end of the list entirely. This does not re-rank measured data
 * below estimates; it just guarantees an India-first row can always be seen.
 *
 * `maxOff` tightens further when the query names no brand (`queryNamesBrand`,
 * `lib/searchRanking.ts`): "boiled egg" is a question about eggs, not about
 * which foreign supermarket sells eggs, so a query without a brand in it only
 * needs a handful of packaged alternatives, not a full page of them. A
 * brand-named query ("amul butter") is unaffected — the caller passes the
 * looser cap in that case.
 */
export function capOpenFoodFactsDominance<T extends { source: string }>(
  foods: T[],
  maxOff = 10
): T[] {
  const kept: T[] = []
  const surplus: T[] = []
  let offSeen = 0
  for (const food of foods) {
    if (!OFF_SOURCES.has(food.source)) {
      kept.push(food)
    } else if (offSeen < maxOff) {
      offSeen++
      kept.push(food)
    } else {
      surplus.push(food)
    }
  }
  return [...kept, ...surplus]
}

/**
 * How much room a query without a named brand gets for Open Food Facts rows,
 * versus the looser default for a query that does name one. See
 * `capOpenFoodFactsDominance`.
 */
export const MAX_OFF_WITHOUT_BRAND = 3

/** How many rows a search response carries. Exported so callers that need to
 *  reserve slots inside that budget don't hard-code the number separately. */
export const MAX_SEARCH_RESULTS = 20

/**
 * Is this a row Open Food Facts does **not** list as sold in India?
 *
 * `lib/open-food-facts.ts` prefixes every fetched row's `source_id` by endpoint:
 * `offi_` for in.openfoodfacts.org (listed as sold in India) and `off_` for
 * world.openfoodfacts.org. `offToExternal` in the search route then flattens
 * `source` to `'off'` for **both**, so after persistence the prefix is the only
 * surviving record of which endpoint a row came from — including for every row
 * already cached in `foods`. `app/api/camera/barcode/route.ts` depends on the
 * same convention. Don't "tidy" either prefix.
 *
 * `offi_` cannot be mistaken for `off_`: the fourth character is `i`, not `_`.
 */
function isForeignOffRow(row: { source: string; source_id?: string | null }): boolean {
  // `source_id` is nullable on `Food`. A null one carries no provenance, so it
  // cannot be shown to be foreign — treat it as Indian and keep it, matching
  // the "an empty screen is worse" bias below.
  return OFF_SOURCES.has(row.source) && (row.source_id?.startsWith('off_') ?? false)
}

/**
 * Hide products Open Food Facts doesn't list as sold in India, but only when we
 * have an Indian answer to offer instead.
 *
 * Searching "boiled egg" returned one Indian row (`Boiled Egg (Anda)`) and five
 * British and American supermarket own-brands — Morrisons, Tesco, Co-op, Vital
 * Farms, Great Value — none of them buyable here, all rendered as identical
 * cards. A new user has no way to tell which to pick, and "2 hard boiled eggs"
 * actively misleads: the name says two eggs, the number is per 100 g.
 *
 * This is deliberately **not** a cap. `capOpenFoodFactsDominance` limits how
 * many packaged rows crowd a page; this asks a different question — is the
 * product available to this user at all — and Indian packaged rows (`offi_`,
 * Amul, Britannia …) are never touched by it.
 *
 * Two escape hatches, both load-bearing:
 * - **Nothing Indian matched** — return the list untouched. A food we only know
 *   from world Open Food Facts must stay findable; an empty screen is worse than
 *   a foreign packet.
 * - **The query names the brand** — someone who types "tesco" means Tesco.
 */
export function dropForeignWhenIndianExists<
  T extends { source: string; source_id?: string | null; brand?: string | null },
>(foods: T[], query: string): T[] {
  const hasIndianRow = foods.some((food) => !isForeignOffRow(food))
  if (!hasIndianRow) return foods
  return foods.filter((food) => !isForeignOffRow(food) || queryNamesBrand(food.brand, query))
}

/**
 * Collapse rows that are the same food — same `foodClusterKey` — down to one,
 * electing the highest-`sourceRank` member of each cluster rather than
 * keeping whichever happened to sort first.
 *
 * This is what fixes "boiled egg" returning three cards (curated 108 kcal,
 * measured IFCT 173, Open Food Facts 140) with a source badge asking the user
 * to arbitrate which to trust — an arbitration `sourceRank` already answers.
 * The winner is emitted at the position of the cluster's *first* member, so
 * `compareFoodsForQuery`'s ordering (which already ran before this) still
 * decides where each food sits in the list; only which row represents it
 * changes.
 *
 * Deliberately conservative, matching `foodClusterKey`: two rows collapse
 * only when their names read as the same food after folding spelling and
 * regional gloss. A branded row never collapses into a brandless one or
 * another brand's row, because `foodClusterKey` folds brand into the key.
 */
export function collapseDuplicateFoods<T extends { name: string; brand?: string | null; source: string }>(
  foods: T[],
  sourceRank: Record<string, number>,
  limit = MAX_SEARCH_RESULTS
): T[] {
  const winnerOf = new Map<string, T>()
  const order: string[] = []

  foods.forEach((food) => {
    const key = foodClusterKey(food)
    if (!winnerOf.has(key)) order.push(key)

    const current = winnerOf.get(key)
    if (!current || (sourceRank[food.source] ?? 0) > (sourceRank[current.source] ?? 0)) {
      winnerOf.set(key, food)
    }
  })

  return order
    .map((key) => winnerOf.get(key)!)
    .slice(0, limit)
}
