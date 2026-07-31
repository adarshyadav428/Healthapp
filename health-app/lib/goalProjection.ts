/**
 * Which goal-date projection to show, and — more importantly — when to show none.
 *
 * The audit's answer to "why doesn't a user come back on day 2?" was that
 * nothing happened on day 1 they want to return TO. They logged a meal and saw a
 * number. A date — "you'll reach 75 kg around 5 December" — is the cheapest
 * thing that turns a tracker into a plan, and the data already exists.
 *
 * There are two projections in this codebase and they are not interchangeable:
 *
 *   MEASURED (lib/weightTrend.ts) — fitted to real weigh-ins over a 28-day
 *     window, gated behind 14 days of data. This is a fact about the user.
 *   PLANNED (lib/projection.ts) — the goal divided by the pace they CHOSE at
 *     onboarding. This is an intention. It is true the moment they set it and
 *     says nothing about whether it is happening.
 *
 * The rule that matters
 * --------------------
 * Fall back from measured to planned ONLY when there is not enough data to
 * measure — never when the measurement exists and is unfavourable.
 *
 * `computeWeightTrend` deliberately returns a null `projectedDate` when the
 * trend points away from the goal. If we treated that null as "no data" and
 * showed the planned date instead, someone actively gaining weight would be
 * told they are on track for 75 kg by December. That is the exact class of
 * confident false claim this app has shipped before (the "500+ IFCT foods"
 * copy, the "full weight history" paywall bullet), and it would be the worst
 * instance of it yet, because the user would have weighed themselves and been
 * told the opposite of what the scale said.
 *
 * So: when we can measure, the measurement wins, including when it says
 * nothing. Silence is a valid answer here; a comforting lie is not.
 *
 * Pure, so both the branch choice and the copy are testable without a render.
 */

import { projectGoalDate } from './projection'
import { formatGoalDate } from './projection'

/** Enough of a WeightTrend to decide. Keeps this module independent of the shape. */
export type TrendInput = {
  /** kg per week, negative when losing. Null when there isn't enough data yet. */
  kgPerWeek: number | null
  /** Null when the target is met, the rate is flat, or the trend points away. */
  projectedDate: Date | null
}

export type GoalProjection =
  /** Fitted to real weigh-ins. A fact. */
  | { kind: 'measured'; date: Date; kgPerWeek: number }
  /** The pace they chose, not the pace they're on. An intention. */
  | { kind: 'planned'; date: Date; weeks: number; paceKgPerWeek: number }
  | { kind: 'none'; reason: NoProjectionReason }

export type NoProjectionReason =
  /** No goal weight set — nothing to project toward. */
  | 'no-target'
  /** Already there. Congratulate elsewhere; don't project a date in the past. */
  | 'at-goal'
  /** We CAN measure, and the measurement gives no honest date. Stay quiet. */
  | 'off-track'
  /** Not enough weigh-ins, and no usable planned pace to fall back on. */
  | 'no-pace'

/** Below this the user is at their goal, within scale noise. */
const AT_GOAL_KG = 0.1

export function goalProjection(input: {
  currentKg: number | null
  targetKg: number | null
  paceKgPerWeek: number | null
  trend: TrendInput
  now?: Date
}): GoalProjection {
  const { currentKg, targetKg, paceKgPerWeek, trend } = input

  if (currentKg == null || targetKg == null || !Number.isFinite(targetKg)) {
    return { kind: 'none', reason: 'no-target' }
  }
  if (Math.abs(currentKg - targetKg) < AT_GOAL_KG) {
    return { kind: 'none', reason: 'at-goal' }
  }

  // We have a real rate, so the real rate decides — in both directions.
  if (trend.kgPerWeek != null) {
    if (trend.projectedDate) {
      return { kind: 'measured', date: trend.projectedDate, kgPerWeek: trend.kgPerWeek }
    }
    // Measured, and it yields no honest date: flat, or moving away from the
    // goal. Do NOT reach for the planned figure here — see the header.
    return { kind: 'none', reason: 'off-track' }
  }

  // Not enough weigh-ins to measure anything. The plan is all we have, and the
  // copy below is careful to present it as a plan.
  const pace = paceKgPerWeek && paceKgPerWeek > 0 ? paceKgPerWeek : null
  const planned = pace ? projectGoalDate(currentKg, targetKg, pace, input.now) : null

  if (!pace || !planned) return { kind: 'none', reason: 'no-pace' }

  return {
    kind: 'planned',
    date: planned.date,
    weeks: planned.weeks,
    paceKgPerWeek: pace,
  }
}

export type GoalProjectionCopy = { headline: string; detail: string }

/**
 * The sentence, kept out of the component so the wording is pinned by tests.
 *
 * The two kinds are deliberately in different grammatical moods. Measured is
 * indicative — this is what is happening. Planned is conditional — this is what
 * would happen IF. A user who has not yet proved the pace must never be handed
 * a flat assertion about their future.
 */
export function goalProjectionCopy(
  projection: GoalProjection,
  targetKg: number
): GoalProjectionCopy | null {
  const target = formatKg(targetKg)

  if (projection.kind === 'measured') {
    // kgPerWeek is negative when losing; the user cares about the magnitude.
    const rate = Math.abs(projection.kgPerWeek).toFixed(2).replace(/\.?0+$/, '')
    return {
      headline: `On track for ${target} kg around ${formatGoalDate(projection.date)}`,
      detail: `Based on your last few weeks — about ${rate} kg a week.`,
    }
  }

  if (projection.kind === 'planned') {
    return {
      headline: `Keep this up and you'll hit ${target} kg around ${formatGoalDate(projection.date)}`,
      detail: `That's at ${formatKg(projection.paceKgPerWeek)} kg a week — weigh in for a few weeks and this becomes a real measurement.`,
    }
  }

  return null
}

/** 75 not 75.0, but 74.5 stays 74.5. */
function formatKg(kg: number): string {
  return Number.isInteger(kg) ? String(kg) : String(+kg.toFixed(1))
}
