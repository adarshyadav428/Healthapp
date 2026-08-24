/**
 * One moment at a time on Home.
 *
 * The dashboard can render eight cards that each ask for attention, and
 * nothing coordinated them — the same failure the push budget was built to fix,
 * one screen further in. Two of them actively contradict each other: at a
 * streak of zero a Pro user with a repairable break would see "your best run
 * was 12 days, start again" directly above "repair your streak and it goes back
 * to 12". Both are true, they cannot both be the next action, and a card that
 * argues with its neighbour is worse than either card alone.
 *
 * Same shape as lib/pushBudget.ts on purpose: a frozen priority order, and a
 * picker that returns at most one.
 *
 * **Scope grew on 2026-08-25.** This used to cover only the three moments Home
 * knew about at render time, and said so: "the prompt cards that probe the
 * browser for themselves — install, rate, notification priming, email
 * verification — still self-gate independently, because their eligibility isn't
 * knowable until they mount. Folding those in needs their checks lifted out
 * first." Their checks are now lifted out (hooks/useHomeSlot.ts does the
 * probing and hands the results here as data), so the list below covers every
 * card on Home that asks for attention.
 *
 * That was the whole problem: coordinating three of eight still left five
 * uncoordinated, and a user could meet a stalled-scale card, a Pro recap, a
 * verify-your-email card, a notifications ask and an install ask on one screen.
 * Each is individually reasonable. Together they are a wall, and the calorie
 * ring — the reason the screen exists — scrolls off the top.
 *
 * The order below is the editorial judgement, stated once so it stops being an
 * accident of JSX order:
 *   1. things that repair or explain the user's own data  (rescue → plateau)
 *   2. things that unlock a capability they already have  (verify → notify)
 *   3. things that only ask                               (rate → install)
 * A pure growth ask never outranks a broken streak.
 */

/** Every moment Home can lead with, most important first. */
export const DASHBOARD_MOMENTS = [
  /**
   * "Repair it and your streak goes back to N." Offered only to Pro, only
   * inside the rescue window, and it is strictly better than starting over —
   * so where both apply, this one wins.
   */
  'streak-rescue',
  /** "Your best run was N days." The comeback, for everyone else at zero. */
  'streak-restart',
  /** The week-3-4 stall, explained. Weeks-long, so it can wait a day. */
  'plateau',
  /**
   * "Your target should move to N." A correction to the number every other
   * screen is measured against, so it outranks anything merely informational.
   */
  'adaptive-target',
  /** The projected goal date. Motivating, but it is news, not an action. */
  'goal-projection',
  /** Pro's Sunday summary. Worth a slot, but it keeps until the streak is safe. */
  'weekly-recap',
  /**
   * Confirming an email unlocks the free AI scans, so this gives the user
   * something. That is why it outranks the two asks below it.
   */
  'verify-email',
  /** Reminders protect the streak — useful, but the app works without them. */
  'notification-prime',
  /** A pure ask: the user gets nothing. Gated on a 3-day streak already. */
  'rate',
  /** The other pure ask, and the most interruptive, so it goes last. */
  'install',
] as const

export type DashboardMoment = (typeof DASHBOARD_MOMENTS)[number]

/** Lower is more important. -1 means "not a moment we know about". */
export function momentPriority(moment: DashboardMoment): number {
  return DASHBOARD_MOMENTS.indexOf(moment)
}

/**
 * The single moment to show, given everything currently eligible.
 * Returns null when nothing is — the common case for a healthy streak.
 */
export function pickDashboardMoment(
  eligible: readonly DashboardMoment[]
): DashboardMoment | null {
  let best: DashboardMoment | null = null
  for (const moment of eligible) {
    // An unknown value scores -1 from indexOf, which would otherwise outrank
    // every real moment and blank the slot. Skip it instead.
    const priority = momentPriority(moment)
    if (priority < 0) continue
    if (best === null || priority < momentPriority(best)) best = moment
  }
  return best
}
