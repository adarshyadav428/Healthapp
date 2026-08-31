/**
 * "What should I eat with 600 kcal left?"
 *
 * The app has always answered "what did I eat". This answers the question users
 * actually have, every day, usually at 8pm — and it's the only Pro benefit that
 * is a new *capability* rather than a wall coming down.
 *
 * Pure and dependency-free, so the ranking is testable without a database and
 * without the deck component. The caller fetches candidates and portion sizes;
 * this decides what's worth suggesting and in what order.
 */

import { SOURCE_RANK } from './foodMatch'
import { LEGACY_LIMITS } from './freeTier'
import type { Food } from '../types/index'

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type SuggestionGap = {
  /** Calories left in the day. Negative or zero means there's no room. */
  kcalRemaining: number
  /** Protein still owed today, in grams. May be 0. */
  proteinRemainingG: number
}

export type Suggestion = {
  food: Food
  /** Grams of the suggested serving. */
  grams: number
  kcal: number
  proteinG: number
  /** 0–1. Exposed so the UI can be honest about weak matches. */
  score: number
  /** True for `curated` rows — category estimates, never measurements. */
  isEstimate: boolean
}

/**
 * A suggestion may fill at most this much of what's left. Recommending a dish
 * that spends the entire remaining budget is technically "fitting" and
 * practically useless — nobody's last meal of the day is their only one.
 */
export const MAX_GAP_SHARE = 0.85

/** Below this there isn't a meal to suggest, only a mint. */
export const MIN_USEFUL_KCAL = 120

/** Free users get a taste, mirroring the AI trial that already converts. */
export const FREE_SUGGESTIONS_PER_DAY = LEGACY_LIMITS.suggestions

/** Serving size for a food, preferring its own declared portion. */
export function servingGrams(food: Food): number {
  if (food.common_portions?.length) {
    const first = food.common_portions[0]
    if (first?.grams > 0) return first.grams
  }
  return food.serving_size_g > 0 ? food.serving_size_g : 100
}

function kcalFor(food: Food, grams: number): number {
  return Math.round((food.kcal_per_100g * grams) / 100)
}

function proteinFor(food: Food, grams: number): number {
  return Math.round((food.protein_g_per_100g * grams) / 100)
}

/**
 * Rank candidate foods against what's left of the day.
 *
 * Scoring, in order of weight:
 *
 *  1. **Fit.** How close the serving lands to the remaining calories, without
 *     exceeding MAX_GAP_SHARE of them.
 *  2. **Protein density.** Two dishes that fit equally, the higher-protein one
 *     wins — it's the macro people under-eat and the one the app coaches on.
 *  3. **Source.** Ties break toward measured data via SOURCE_RANK, so an IFCT
 *     row beats a `curated` estimate of the same dish. This is the same
 *     ordering food search uses; a deck that promoted estimates over
 *     measurements would be quietly claiming precision it doesn't have.
 *
 * `dismissedIds` are foods the user swiped away. They never come back — a
 * suggestion engine that keeps re-offering a rejected dish reads as not
 * listening, and one bad card poisons the whole feature.
 */
export function suggestMeals(
  candidates: readonly Food[],
  gap: SuggestionGap,
  opts: { dismissedIds?: readonly string[]; limit?: number } = {}
): Suggestion[] {
  const { kcalRemaining, proteinRemainingG } = gap
  if (kcalRemaining < MIN_USEFUL_KCAL) return []

  const dismissed = new Set(opts.dismissedIds ?? [])
  const ceiling = kcalRemaining * MAX_GAP_SHARE
  const out: Suggestion[] = []

  for (const food of candidates) {
    if (dismissed.has(food.id)) continue
    // A row with no calories is either broken data or water. Neither is a meal.
    if (!(food.kcal_per_100g > 0)) continue

    const grams = servingGrams(food)
    const kcal = kcalFor(food, grams)
    if (kcal <= 0 || kcal > ceiling) continue

    // Fit: 1 at the ceiling, tapering to 0 at nothing. Bigger is better here —
    // the point is to fill the gap, not to nibble at it.
    const fit = kcal / ceiling

    // Protein: measured against what's still owed, so the deck shifts toward
    // protein late in a day the user has under-eaten it. Without a target it
    // falls back to plain density so the term never vanishes.
    const protein = proteinFor(food, grams)
    const proteinScore =
      proteinRemainingG > 0
        ? Math.min(1, protein / proteinRemainingG)
        : Math.min(1, food.protein_g_per_100g / 25)

    const sourceScore = (SOURCE_RANK[food.source] ?? 0) / 6

    const score = fit * 0.55 + proteinScore * 0.3 + sourceScore * 0.15

    out.push({
      food,
      grams,
      kcal,
      proteinG: protein,
      score,
      isEstimate: food.source === 'curated',
    })
  }

  out.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    // Deterministic tail: source, then name. Without this the deck reorders
    // itself between renders for equally-scored rows.
    const bySource = (SOURCE_RANK[b.food.source] ?? 0) - (SOURCE_RANK[a.food.source] ?? 0)
    if (bySource !== 0) return bySource
    return a.food.name.localeCompare(b.food.name)
  })

  return out.slice(0, opts.limit ?? 20)
}
