// "You'll reach X kg by ~date" — the projected goal-date moment (Cal AI's
// signature conversion trick). Pure so tests pin the math.

import { formatIst } from './dateUtils'

const DAY_MS = 24 * 60 * 60 * 1000

/** Weeks to reach the target at the given weekly pace, or null when it doesn't
 *  apply (no/negative pace, or already at goal). Direction-agnostic (works for
 *  lose and gain). */
export function weeksToGoal(currentKg: number, targetKg: number, paceKgPerWeek: number): number | null {
  if (!paceKgPerWeek || paceKgPerWeek <= 0) return null
  const gap = Math.abs(currentKg - targetKg)
  if (gap < 0.1) return null
  return gap / paceKgPerWeek
}

/** Projected goal date + weeks, or null when a projection doesn't apply. */
export function projectGoalDate(
  currentKg: number,
  targetKg: number,
  paceKgPerWeek: number,
  from: Date = new Date()
): { date: Date; weeks: number } | null {
  const weeks = weeksToGoal(currentKg, targetKg, paceKgPerWeek)
  if (weeks == null) return null
  return { date: new Date(from.getTime() + Math.round(weeks * 7) * DAY_MS), weeks }
}

/** Friendly date, e.g. "5 Dec 2026". IST, so the projected date reads the same
 *  on a phone abroad as it does on the server that computed it. */
export function formatGoalDate(date: Date): string {
  return formatIst(date, { day: 'numeric', month: 'short', year: 'numeric' }, 'en-GB')
}
