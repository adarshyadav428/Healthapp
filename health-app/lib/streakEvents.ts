import { calculateStreakState, countsTowardStreak, longestStreak, type StreakLog } from './streak'

/**
 * Which streak-lifecycle events a newly-created log produces.
 *
 * `lib/posthog/events.ts` declared STREAK_INCREMENTED, STREAK_FROZEN and
 * DAY_COMPLETED from the start and never fired any of them — the streak is
 * recomputed pure from logs on every render, so nothing was ever *notified*
 * that it changed. That left the core habit loop invisible in analytics: you
 * could see that a log happened, but not whether it extended a streak, spent a
 * freeze, or was someone's first day back.
 *
 * Pure, and takes the log history as an argument, following the
 * `calculateStreakState` precedent — no table reads in here.
 *
 * `streak_frozen` means "this log came back across a gap a banked freeze had
 * covered" — see the note at the call site for why it cannot mean "a freeze was
 * spent just now".
 *
 * ## Why there is no `streak_broken`
 *
 * A break is an *absence*. It can only be observed either when the user
 * returns, or never — and "never" is exactly the cohort that matters for
 * churn. An event fired on the comeback log would therefore undercount breaks
 * by however many people never came back, while looking like a complete count.
 *
 * So this emits `streak_restarted`, which is precisely what a comeback log
 * proves, and true breaks are derived downstream from gaps in `day_completed`.
 * Naming the event after what we can actually see keeps the funnel honest.
 */

export type StreakEventName =
  | 'day_completed'
  | 'streak_incremented'
  | 'streak_frozen'
  | 'streak_restarted'

/**
 * All these calculations need from a log is when it happened — and, since the
 * streak stopped counting days filled in after the fact, when it was written.
 * An alias rather than its own shape: two structural types for "the columns the
 * streak reads" is how one of them ends up missing `created_at`.
 */
export type LoggedAt = StreakLog

export type StreakEvent = {
  name: StreakEventName
  props: Record<string, number>
}

/**
 * @param logsBefore  The user's logs as they were *before* this one landed.
 * @param newLoggedAt The new log's `logged_at` (UTC ISO string).
 * @param rescuedDates IST date keys a Pro rescue covered, passed in as
 *                     `calculateStreakState` requires.
 */
export function streakEventsForLog(
  logsBefore: readonly LoggedAt[],
  newLoggedAt: string,
  rescuedDates: readonly string[] = [],
  referenceDate: Date = new Date()
): StreakEvent[] {
  // The row being created right now, so its `created_at` is `referenceDate` by
  // definition — which is exactly what makes a log with a past `logged_at`
  // recognisable as a backfill without the caller passing anything extra.
  const newLog: StreakLog = { logged_at: newLoggedAt, created_at: referenceDate.toISOString() }

  const after = calculateStreakState([...logsBefore, newLog], referenceDate, rescuedDates)

  // A second log on a day that already had one changes nothing about the
  // streak. Emitting on every log would make day_completed a duplicate of
  // food_logged and destroy its meaning.
  const istKey = (iso: string) =>
    new Date(new Date(iso).getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const newKey = istKey(newLoggedAt)
  if (logsBefore.some((l) => istKey(l.logged_at) === newKey)) return []

  const before = calculateStreakState(logsBefore, referenceDate, rescuedDates)

  // `backfilled` is what keeps "breaks are gaps in day_completed" true after the
  // streak stopped counting filled-in days. The day really did gain data, so the
  // event still fires — but a gap closed on a Sunday afternoon is not a day the
  // user showed up for, and without this flag it would look like one.
  const backfilled = countsTowardStreak(newLog) ? 0 : 1
  const events: StreakEvent[] = [
    { name: 'day_completed', props: { streak: after.streak, backfilled } },
  ]

  if (after.streak > before.streak) {
    events.push({ name: 'streak_incremented', props: { streak: after.streak } })
  }

  // A freeze is spent the moment a day passes unlogged, not when the next log
  // arrives — so it is already spent in `before` and comparing frozen-day
  // counts across the two states can never see it. What this log *does* prove
  // is that the user came back across a gap a freeze had covered, which is the
  // moment worth recording: the freeze did its job.
  const priorKeys = [...new Set(logsBefore.map((l) => istKey(l.logged_at)))].sort()
  const lastPrior = priorKeys[priorKeys.length - 1]
  const bridged = lastPrior === undefined
    ? []
    : after.frozenDays.filter((d) => d > lastPrior && d < newKey)
  if (bridged.length > 0) {
    events.push({
      name: 'streak_frozen',
      props: { streak: after.streak, days_covered: bridged.length },
    })
  }

  // Back after a lapse: the run restarted at 1 despite a real streak in their
  // history. `longestStreak` deliberately ignores freezes, so this only counts
  // a genuine previous run.
  const previousBest = longestStreak(logsBefore)
  if (after.streak === 1 && previousBest >= 2) {
    events.push({ name: 'streak_restarted', props: { streak: 1, previous_best: previousBest } })
  }

  return events
}
