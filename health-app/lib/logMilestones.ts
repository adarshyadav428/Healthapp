/**
 * Pure decision logic for the two one-time surfaces that fire after a
 * successful food log:
 *
 *  - first_log_celebration — confetti moment on the user's first-ever log
 *  - log_paywall — one-time dismissible upgrade interstitial once a free
 *    user's lifetime log count reaches LOG_PAYWALL_THRESHOLD. It never
 *    blocks logging (free logs stay unlimited per CLAUDE.md); it only
 *    guarantees every free user sees the paywall once.
 *
 * The server reports `milestone` on every successful log response; the
 * client owns the "already seen" flags (localStorage, per user) so the
 * decision lives here where both sides can share it and tests can cover it.
 */

export type LogMilestone = {
  /** This request created the user's first-ever log(s). */
  isFirstLog: boolean
  /** Lifetime log count AFTER this request's insert. */
  totalLogs: number
  isPro: boolean
}

export type MilestoneAction = 'first_log_celebration' | 'log_paywall' | null

/**
 * Lifetime logs after which a free user is shown the paywall once.
 *
 * Was 3. The interstitial's stated job is to "guarantee every free user sees
 * the paywall once" — but a threshold can only guarantee that for users who
 * reach it, and reaching three logs is a bar most new signups never clear. The
 * users who churn early were the ones the guarantee silently excluded, and they
 * are the majority.
 *
 * At 2 the offer lands on the log right after the first-log celebration, which
 * for anyone who logs twice in a sitting is the same session — while the
 * product has just visibly worked. That is the moment worth asking in, and it
 * costs nothing to be wrong about: the interstitial is one-time, dismissible,
 * and never blocks logging, because free logs stay unlimited (CLAUDE.md).
 *
 * This is a judgement, not a measurement — it is the one number in this change
 * not backed by data. The funnel already emits `paywall_viewed` with a source
 * and `upgrade_completed`, so two weeks of real traffic settles whether 2 or 3
 * converts better far more honestly than any benchmark can.
 */
export const LOG_PAYWALL_THRESHOLD = 2

/**
 * Streak lengths (days) worth a one-time celebration. The early rungs (3, 14,
 * 21) exist because the drop-off is in week one — a first win at day 3 is worth
 * more than a distant one at day 30.
 */
export const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 100] as const

/**
 * The subset big enough to be worth offering a share card for. Every milestone
 * is celebrated in-app; only these three are ones people actually want to post,
 * and prompting on all seven would train users to dismiss the prompt.
 */
export const STREAK_SHARE_MILESTONES = [7, 30, 100] as const

/** Whether a reached milestone should offer the share card. */
export function isShareableStreakMilestone(days: number): boolean {
  return (STREAK_SHARE_MILESTONES as readonly number[]).includes(days)
}

/**
 * The streak milestone to celebrate right now, or null.
 *
 * Only the HIGHEST milestone the user has reached is a candidate: an existing
 * user well past several rungs celebrates once at their real level rather than
 * being walked up the ladder, and — since the ladder gained early rungs (3, 14,
 * 21) — someone who already celebrated day 7 is never handed a stale "3 day
 * streak!" for a rung they silently passed weeks ago.
 *
 * If that highest reached milestone has already been seen, there is nothing to
 * celebrate until the next one is reached.
 */
export function nextUnseenStreakMilestone(streakDays: number, seen: readonly number[]): number | null {
  let highestReached: number | null = null
  for (const t of STREAK_MILESTONES) {
    if (streakDays >= t) highestReached = t
  }
  if (highestReached === null) return null
  return seen.includes(highestReached) ? null : highestReached
}

export function getLogMilestoneAction(
  m: LogMilestone,
  seen: { celebrationSeen: boolean; paywallSeen: boolean }
): MilestoneAction {
  // Celebration wins: a first-ever bulk log of 3+ items must not stack two
  // overlays — the paywall then fires on the next log instead.
  if (m.isFirstLog && !seen.celebrationSeen) return 'first_log_celebration'
  // >= (not ===) so existing free users past the threshold still see the
  // interstitial once on their next log.
  if (!m.isPro && m.totalLogs >= LOG_PAYWALL_THRESHOLD && !seen.paywallSeen) return 'log_paywall'
  return null
}
