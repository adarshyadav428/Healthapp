/**
 * Stats for the story surfaces — the Pro welcome, the monthly Wrapped, and the
 * season wrap all read from here.
 *
 * This is deliberately a different shape from `lib/weeklyRecap.ts`. The recap
 * answers "how was your week" in three numbers and one sentence; a story needs
 * a *vocabulary* — one stat per card, each strong enough to hold a full screen
 * on its own. "412 meals" is a number. "Dal Tadka, 27 times" is a screenshot.
 *
 * Pure, so tests/wrappedStats.test.ts can pin the tie-breaks and the empty
 * cases. Every caller does its own fetching and hands the rows in; nothing here
 * touches Supabase.
 */

import { calculateStreakState, longestStreak } from './streak'
import type { FoodLog } from '../types/index'

/** A weigh-in, narrowed to the two fields the window needs. */
export type WrappedWeighIn = { weight_kg: number; measured_at: string }

export type WrappedInput = {
  /** Food logs inside the window, any order. `food.name` drives the top dish. */
  logs: FoodLog[]
  /** Weigh-ins inside the window, any order. */
  weighIns: WrappedWeighIn[]
  /** Daily protein goal, for the "days you hit protein" count. */
  proteinTargetG: number | null
  /** Lifetime or in-window AI calls — the caller decides which it's showing. */
  aiScans?: number
}

export type TopFood = { name: string; count: number }
export type BestDay = { date: string; kcal: number; proteinG: number }

export type WrappedStats = {
  /** Distinct IST days with at least one log. */
  daysLogged: number
  /** Individual food log rows — "meals" in the loose, user-facing sense. */
  totalMeals: number
  /** Mean kcal across logged days only; 0 when nothing was logged. */
  avgKcal: number
  /** Most-logged dish in the window; null when no log carries a name. */
  topFood: TopFood | null
  /** Best streak reached inside the window. */
  longestStreakDays: number
  /** Streak running as of the window's end. */
  currentStreakDays: number
  /** Days whose total protein met or beat the target; 0 without a target. */
  proteinDaysHit: number
  /** Last − first weigh-in, 1 dp. Null with fewer than two. */
  weightDeltaKg: number | null
  /** The day with the most protein — a hero moment, not a calorie record. */
  bestDay: BestDay | null
  aiScans: number
  /** False when there is nothing worth telling a story about (see §4c). */
  hasStory: boolean
}

// IST, matching lib/streak.ts — a 12:30am log belongs to the previous IST day,
// and every "days logged" figure in the app has to agree about that.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

function istDateKey(iso: string): string {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/**
 * A story needs at least one real day in it. Below this the welcome sequence
 * shows its day-one variant instead — a card reading "0 meals, 0 days" at the
 * emotional peak of the product is worse than not showing the card at all.
 */
export const MIN_DAYS_FOR_STORY = 1

export function computeWrappedStats(input: WrappedInput): WrappedStats {
  const { logs, weighIns, proteinTargetG, aiScans = 0 } = input

  // ── Per-day rollup (one pass) ────────────────────────────────────────────
  const byDay = new Map<string, { kcal: number; proteinG: number }>()
  for (const log of logs) {
    const key = istDateKey(log.logged_at)
    const day = byDay.get(key) ?? { kcal: 0, proteinG: 0 }
    day.kcal += log.kcal ?? 0
    day.proteinG += log.protein_g ?? 0
    byDay.set(key, day)
  }

  const daysLogged = byDay.size
  const totalMeals = logs.length
  const totalKcal = [...byDay.values()].reduce((sum, d) => sum + d.kcal, 0)
  const avgKcal = daysLogged ? Math.round(totalKcal / daysLogged) : 0

  const proteinDaysHit =
    proteinTargetG && proteinTargetG > 0
      ? [...byDay.values()].filter((d) => d.proteinG >= proteinTargetG).length
      : 0

  // ── Top dish ─────────────────────────────────────────────────────────────
  // Counted by name, not food_id: the same dish can arrive from IFCT, a
  // curated estimate, or an Open Food Facts row, and the user thinks of those
  // as one food. Ties break alphabetically so the answer is deterministic —
  // Map iteration order would otherwise leak insertion order into the UI.
  const nameCounts = new Map<string, number>()
  for (const log of logs) {
    const name = log.food?.name?.trim()
    if (!name) continue
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
  }
  let topFood: TopFood | null = null
  for (const [name, count] of nameCounts) {
    if (!topFood || count > topFood.count || (count === topFood.count && name < topFood.name)) {
      topFood = { name, count }
    }
  }

  // ── Best day: most protein ───────────────────────────────────────────────
  // Protein rather than calories on purpose. "Your biggest calorie day" is not
  // a compliment in a weight-loss app, and a hero card has to be a compliment.
  let bestDay: BestDay | null = null
  for (const [date, day] of byDay) {
    if (!bestDay || day.proteinG > bestDay.proteinG || (day.proteinG === bestDay.proteinG && date < bestDay.date)) {
      bestDay = { date, kcal: Math.round(day.kcal), proteinG: Math.round(day.proteinG) }
    }
  }

  // ── Weight ───────────────────────────────────────────────────────────────
  const sortedWeighIns = [...weighIns].sort(
    (a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime()
  )
  const weightDeltaKg =
    sortedWeighIns.length >= 2
      ? Math.round(
          (sortedWeighIns[sortedWeighIns.length - 1].weight_kg - sortedWeighIns[0].weight_kg) * 10
        ) / 10
      : null

  return {
    daysLogged,
    totalMeals,
    avgKcal,
    topFood,
    longestStreakDays: longestStreak(logs),
    currentStreakDays: calculateStreakState(logs).streak,
    proteinDaysHit,
    weightDeltaKg,
    bestDay,
    aiScans,
    hasStory: daysLogged >= MIN_DAYS_FOR_STORY,
  }
}
