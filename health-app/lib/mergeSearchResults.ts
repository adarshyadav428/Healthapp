import type { Food } from '../types/index'
import { foodClusterKey } from './foodClusterKey'

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
