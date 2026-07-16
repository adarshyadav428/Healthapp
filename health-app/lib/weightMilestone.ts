/**
 * Weight milestone: celebrate when a new weigh-in crosses a whole-kg loss
 * threshold the user has never reached before (baseline = their earliest
 * weigh-in). Fires once per threshold by construction — the next weigh-in at
 * the same loss no longer beats the previous best — so no seen-flags needed.
 */

export type WeightPoint = { weight_kg: number; measured_at: string }

// Float slack: 0.1-step weights aren't exact in binary (82 - 78.9 = 3.099…96).
const EPS = 1e-6

export function computeWeightMilestone(args: {
  /** Earliest existing weigh-in (by measured_at); null when this is the first. */
  baseline: WeightPoint | null
  /** Lightest existing weigh-in, kg; null when there are none. */
  minWeightKg: number | null
  entry: WeightPoint
}): number | null {
  const { baseline, minWeightKg, entry } = args
  if (!baseline || minWeightKg == null) return null

  // A back-dated entry earlier than the baseline rewrites history rather
  // than achieving anything new — never celebrate it.
  if (new Date(entry.measured_at).getTime() < new Date(baseline.measured_at).getTime()) return null

  const bestBefore = baseline.weight_kg - minWeightKg
  const lossNew = baseline.weight_kg - entry.weight_kg

  const reached = Math.floor(lossNew + EPS)
  const previous = Math.floor(Math.max(bestBefore, 0) + EPS)
  return reached >= 1 && reached > previous ? reached : null
}
