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
 * Scope: this covers the moments Home already knows about when it renders.
 * The prompt cards that probe the browser for themselves — install, rate,
 * notification priming, email verification — still self-gate independently,
 * because their eligibility isn't knowable until they mount. Folding those in
 * needs their checks lifted out first; until then this is the ordering for the
 * three that genuinely collide.
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
