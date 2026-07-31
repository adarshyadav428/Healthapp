/**
 * The plateau response.
 *
 * Weight loss stalls for almost everyone around week 3–4. The app currently
 * says nothing when it happens, and the user concludes it isn't working and
 * stops. The audit's judgement was that one honest, well-timed "this is the
 * normal part, here's what's actually going on" moment would outperform every
 * growth mechanic in the codebase — and it costs a card, not a subsystem.
 *
 * How this differs from lib/adaptiveTarget
 * ---------------------------------------
 * `suggestTargetAdjustment` looks at ONE week and proposes a calorie change.
 * This looks at three-plus weeks of the SMOOTHED trend and proposes an
 * explanation. They are complementary — this frames what is happening, that
 * offers the lever — and they must never contradict each other, which is why
 * this module never recommends a number.
 *
 * The rule that matters
 * --------------------
 * A flat scale has more than one cause, and only one of them is physiology.
 * Telling someone who has averaged 400 kcal over target for a month that
 * plateaus are a mysterious metabolic phenomenon is a comforting lie, and it
 * costs them the month. So intake is checked BEFORE the reassuring explanation
 * is offered, and when the logs explain the stall, the logs are what we say —
 * plainly, and without shaming, per the tone rule the rest of the app follows.
 *
 * And when we genuinely cannot tell — too few logged days to judge intake — we
 * say the true thing (the scale is flat) and decline to explain why, rather
 * than picking whichever cause sounds kindest.
 *
 * Pure, so every branch and every sentence is testable.
 */

/** Weekly change smaller than this is not movement, it is scale noise. */
export const PLATEAU_KG_PER_WEEK = 0.1

/**
 * A plateau needs three weeks. Two flat weeks inside a fat-loss phase are
 * completely ordinary — calling that a plateau would teach users to panic on
 * schedule, which is the opposite of the point.
 */
export const PLATEAU_MIN_DAYS = 21

/** Below this many logged days in the window we cannot speak about intake. */
export const MIN_LOGGED_DAYS_TO_JUDGE_INTAKE = 10

/** Average daily excess above which intake is the plain explanation. */
export const OVER_TARGET_KCAL = 100

export type PlateauInput = {
  /** Smoothed kg/week from computeWeightTrend. Null when there isn't enough data. */
  trendKgPerWeek: number | null
  /** Days spanned by the weigh-in series the trend was fitted to. */
  trendSpanDays: number
  /** Days in that window with at least one food log. */
  daysLogged: number
  /** Mean daily kcal across the days that were logged. Null when none were. */
  avgKcal: number | null
  /** The user's daily calorie target. */
  dailyTarget: number
  goal: 'lose' | 'gain' | 'maintain'
}

export type Plateau =
  /**
   * Flat, logging consistently, intake in line with target. This is the one the
   * feature exists for: nothing is wrong, and the user needs to hear it.
   */
  | { kind: 'holding'; weeks: number }
  /** Flat, and the logs say why. Intake, not metabolism. */
  | { kind: 'intake'; weeks: number; avgKcal: number; overBy: number }
  /** Flat, but too little logged to attribute a cause. Say so; explain nothing. */
  | { kind: 'unknown'; weeks: number }
  | { kind: 'none'; reason: NoPlateauReason }

export type NoPlateauReason =
  /** Fewer than 14 days of weigh-ins — computeWeightTrend has no rate yet. */
  | 'no-trend'
  /** Flat for less than three weeks. Ordinary, not a plateau. */
  | 'too-soon'
  /** The scale is moving. Nothing to explain. */
  | 'moving'
  /** Maintaining is meant to be flat. */
  | 'maintaining'

export function detectPlateau(input: PlateauInput): Plateau {
  const { trendKgPerWeek, trendSpanDays, daysLogged, avgKcal, dailyTarget, goal } = input

  // A flat line is the GOAL when maintaining — congratulating someone for it is
  // a different feature, and alarming them would be absurd.
  if (goal === 'maintain') return { kind: 'none', reason: 'maintaining' }

  if (trendKgPerWeek == null) return { kind: 'none', reason: 'no-trend' }
  if (Math.abs(trendKgPerWeek) >= PLATEAU_KG_PER_WEEK) return { kind: 'none', reason: 'moving' }
  if (trendSpanDays < PLATEAU_MIN_DAYS) return { kind: 'none', reason: 'too-soon' }

  const weeks = Math.floor(trendSpanDays / 7)

  // Intake first. If the logs explain the stall, the logs are the answer, and
  // the physiology reassurance below would be a lie told kindly.
  if (daysLogged < MIN_LOGGED_DAYS_TO_JUDGE_INTAKE || avgKcal == null) {
    return { kind: 'unknown', weeks }
  }

  const overBy = Math.round(avgKcal - dailyTarget)
  if (goal === 'lose' && overBy >= OVER_TARGET_KCAL) {
    return { kind: 'intake', weeks, avgKcal: Math.round(avgKcal), overBy }
  }
  // Gaining and under target is the mirror case, and equally explainable.
  if (goal === 'gain' && -overBy >= OVER_TARGET_KCAL) {
    return { kind: 'intake', weeks, avgKcal: Math.round(avgKcal), overBy }
  }

  return { kind: 'holding', weeks }
}

export type PlateauCopy = { headline: string; body: string }

/**
 * The words. Kept beside the detection so the pairing is pinned by tests — the
 * risk in this feature is not a wrong branch, it is the right branch saying
 * something untrue or preachy.
 */
export function plateauCopy(plateau: Plateau, goal: 'lose' | 'gain' | 'maintain'): PlateauCopy | null {
  if (plateau.kind === 'none') return null

  const span = `${plateau.weeks} weeks`

  if (plateau.kind === 'holding') {
    return {
      headline: `${capitalise(span)} without much movement — this is the normal part`,
      // Two real mechanisms, no mysticism, and credit where it is due. The last
      // sentence matters most: it is the reason to still be here next week.
      body:
        'Fat loss and scale weight come apart for weeks at a time — water shifts with salt, carbs and stress can hide a real loss completely. Your logs show you doing the work, and that is the part you control. Keep going and weigh in at the same time each morning.',
    }
  }

  if (plateau.kind === 'intake') {
    const direction = goal === 'lose' ? 'above' : 'below'
    const amount = Math.abs(plateau.overBy)
    return {
      headline: `${capitalise(span)} without much movement`,
      // Plain, specific, no scolding — the same register as "X over" on the
      // dashboard. A number they can act on beats an adjective they can't.
      body: `Your logs average ${plateau.avgKcal.toLocaleString('en-IN')} kcal a day, about ${amount} ${direction} your target. That is the likeliest reason, and it is the easiest thing to change.`,
    }
  }

  return {
    headline: `${capitalise(span)} without much movement`,
    // We do not know why, so we do not guess. Asking for the missing data is
    // both the honest move and the useful one.
    body: 'Too few logged days to tell what is behind it. Log consistently for a week or two and the picture usually explains itself.',
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Window over which intake is judged. Matches the trend's smoothing window. */
export const INTAKE_WINDOW_DAYS = 28

/**
 * Days logged and mean daily intake over the recent window.
 *
 * The average is over DAYS THAT WERE LOGGED, not over the window — dividing by
 * 28 when someone logged 14 days would halve their apparent intake and turn
 * every sparse logger into a model dieter. That is why `daysLogged` is returned
 * alongside it and why the caller refuses to judge intake below a threshold:
 * the mean is only meaningful with the count beside it.
 *
 * Grouping is by IST date, like everything else that means "a day" here.
 */
export function intakeSummary(
  logs: readonly { logged_at: string; kcal: number }[],
  istDayOf: (iso: string) => string,
  now: Date = new Date(),
  windowDays: number = INTAKE_WINDOW_DAYS
): { daysLogged: number; avgKcal: number | null } {
  const cutoff = now.getTime() - windowDays * 24 * 60 * 60 * 1000
  const byDay = new Map<string, number>()

  for (const log of logs) {
    const t = new Date(log.logged_at).getTime()
    if (!Number.isFinite(t) || t < cutoff) continue
    if (!Number.isFinite(log.kcal)) continue
    const day = istDayOf(log.logged_at)
    byDay.set(day, (byDay.get(day) ?? 0) + log.kcal)
  }

  const daysLogged = byDay.size
  if (daysLogged === 0) return { daysLogged: 0, avgKcal: null }

  const total = [...byDay.values()].reduce((sum, kcal) => sum + kcal, 0)
  return { daysLogged, avgKcal: total / daysLogged }
}
