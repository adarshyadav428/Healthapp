/**
 * Weekly calorie-target adjustment.
 *
 * Mifflin-St Jeor gives an estimate, not a measurement — real TDEE varies by
 * 10-15% between people with identical stats (NEAT, thermic effect, water
 * shifts, how honestly a week got logged). Rather than leaving someone stalled
 * against a number that was wrong for their body, compare the weight actually
 * lost against the pace they chose and nudge the target.
 *
 * Deliberately conservative:
 *  - At most MAX_STEP_KCAL per week, so the target drifts rather than lurches.
 *  - Nothing happens without MIN_DAYS_LOGGED days of data — adjusting on three
 *    logged days is fitting noise, and it punishes people for a quiet week.
 *  - Never below MIN_SAFE_KCAL, whatever the trend says.
 *  - Deviations inside DEADBAND_KG_PER_WEEK are ignored: weight is noisy at the
 *    week scale and chasing every wobble would ratchet the target downward.
 *
 * Pure so it's unit-testable (tests/adaptiveTarget.test.ts).
 */

import { KCAL_PER_KG_FAT } from './tdee'

/** Largest single-week change, in kcal. */
export const MAX_STEP_KCAL = 150
/** Days that must be logged in the week before we trust the trend at all. */
export const MIN_DAYS_LOGGED = 5
/** Hard floor — never recommend a target below this. */
export const MIN_SAFE_KCAL = 1200
/** Weekly pace error smaller than this is noise, not a signal. */
export const DEADBAND_KG_PER_WEEK = 0.15

export type AdaptiveSuggestion = {
  /** The recommended new daily calorie target. */
  newTarget: number
  /** Signed change from the current target. */
  deltaKcal: number
  /** Plain-language justification to show the user. */
  reason: string
}

/**
 * @param currentTarget   today's daily calorie target
 * @param actualKgChange  weight change over the week (negative = lost)
 * @param goalKgPerWeek   intended pace, always positive; goal direction sets sign
 * @param goal            'lose' | 'gain' | 'maintain'
 * @param daysLogged      days with at least one food log in that week
 * @returns a suggestion, or null when no change is warranted
 */
export function suggestTargetAdjustment(args: {
  currentTarget: number
  actualKgChange: number
  goalKgPerWeek: number
  goal: 'lose' | 'gain' | 'maintain'
  daysLogged: number
}): AdaptiveSuggestion | null {
  const { currentTarget, actualKgChange, goalKgPerWeek, goal, daysLogged } = args

  if (!Number.isFinite(currentTarget) || currentTarget <= 0) return null
  if (!Number.isFinite(actualKgChange)) return null
  if (daysLogged < MIN_DAYS_LOGGED) return null
  // Maintaining has no intended drift, so there is no pace error to correct.
  if (goal === 'maintain') return null

  // Intended change is negative when losing.
  const intendedKgChange = goal === 'lose' ? -Math.abs(goalKgPerWeek) : Math.abs(goalKgPerWeek)
  const errorKg = actualKgChange - intendedKgChange

  if (Math.abs(errorKg) < DEADBAND_KG_PER_WEEK) return null

  // Convert the week's shortfall into the daily calorie change that explains it,
  // then clamp. Losing too slowly => errorKg positive => target must come down.
  const rawDailyKcal = (errorKg * KCAL_PER_KG_FAT) / 7
  const step = Math.max(-MAX_STEP_KCAL, Math.min(MAX_STEP_KCAL, Math.round(rawDailyKcal)))

  const proposed = currentTarget - step
  const newTarget = Math.max(MIN_SAFE_KCAL, proposed)
  const deltaKcal = newTarget - currentTarget

  // Clamping at the floor can erase the change entirely — say nothing then.
  if (deltaKcal === 0) return null

  const losingTooSlow = goal === 'lose' && errorKg > 0
  const losingTooFast = goal === 'lose' && errorKg < 0
  const reason =
    losingTooSlow ? `Progress was slower than your ${goalKgPerWeek} kg/week pace, so we're lowering your target slightly.`
    : losingTooFast ? `You're losing faster than planned — eating a little more keeps this sustainable.`
    : errorKg < 0 ? `Gains were slower than your ${goalKgPerWeek} kg/week pace, so we're raising your target slightly.`
    : `You're gaining faster than planned — easing the target back keeps it lean.`

  return { newTarget, deltaKcal, reason }
}
