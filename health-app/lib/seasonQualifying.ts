/**
 * Which IST days count toward a season, per focus.
 *
 * Kept apart from lib/seasons.ts so that file stays a pure description of the
 * seasons themselves. This is the half that knows about logs.
 */

import type { SeasonFocus } from './seasons'

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

function istKey(iso: string): string {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

export type QualifyingInput = {
  /** Food logs in the season window. */
  foodLogs: readonly { logged_at: string; protein_g?: number }[]
  /** Weigh-ins in the season window. */
  weighIns: readonly { measured_at: string }[]
  /** Daily protein goal, for the protein focus. */
  proteinTargetG: number | null
}

/**
 * The set of IST days that qualified.
 *
 * `protein` sums a whole day before judging it — three modest meals can clear a
 * target that none of them clears alone, and scoring per-meal would make the
 * season unwinnable for anyone who eats normally.
 */
export function qualifyingDays(focus: SeasonFocus, input: QualifyingInput): string[] {
  if (focus === 'weigh_in') {
    return [...new Set(input.weighIns.map((w) => istKey(w.measured_at)))]
  }

  if (focus === 'consistency') {
    return [...new Set(input.foodLogs.map((l) => istKey(l.logged_at)))]
  }

  // protein
  const target = input.proteinTargetG ?? 0
  if (target <= 0) return []

  const byDay = new Map<string, number>()
  for (const log of input.foodLogs) {
    const key = istKey(log.logged_at)
    byDay.set(key, (byDay.get(key) ?? 0) + (log.protein_g ?? 0))
  }
  return [...byDay.entries()].filter(([, g]) => g >= target).map(([day]) => day)
}
