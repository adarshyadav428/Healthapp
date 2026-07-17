import type { Food } from '../types/index'

/**
 * Dedupe a list of foods by normalized name + brand, keeping the FIRST
 * occurrence, and cap at `limit`. Order matters: callers put higher-priority
 * sources first (e.g. accurate IFCT/OFF rows before a user's rough AI
 * estimates) so a name collision resolves in favour of the earlier entry.
 */
export function dedupeFoodsByNameBrand(foods: Food[], limit = 20): Food[] {
  const deduped = new Map<string, Food>()
  for (const food of foods) {
    const key = `${food.name.toLowerCase().replace(/\s+/g, ' ')}-${(food.brand ?? '').toLowerCase()}`
    if (!deduped.has(key)) deduped.set(key, food)
  }
  return Array.from(deduped.values()).slice(0, limit)
}
