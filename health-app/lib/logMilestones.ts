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

export const LOG_PAYWALL_THRESHOLD = 3

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
