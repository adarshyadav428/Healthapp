import type { Food } from '../types/index'

/**
 * Dedupe a list of foods by normalized name + brand, keeping the FIRST
 * occurrence, and cap at `limit`. Order matters: callers put higher-priority
 * sources first (e.g. accurate IFCT/OFF rows before a user's rough AI
 * estimates) so a name collision resolves in favour of the earlier entry.
 */
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

/** How many rows a search response carries. Exported so callers that need to
 *  reserve slots inside that budget don't hard-code the number separately. */
export const MAX_SEARCH_RESULTS = 20

export function dedupeFoodsByNameBrand(foods: Food[], limit = MAX_SEARCH_RESULTS): Food[] {
  const deduped = new Map<string, Food>()
  for (const food of foods) {
    const key = `${food.name.toLowerCase().replace(/\s+/g, ' ')}-${(food.brand ?? '').toLowerCase()}`
    if (!deduped.has(key)) deduped.set(key, food)
  }
  return Array.from(deduped.values()).slice(0, limit)
}
