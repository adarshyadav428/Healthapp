/**
 * The single source of truth for every free-tier limit.
 *
 * Consolidates eleven hand-maintained copies (two were already provably
 * duplicated, one already off-by-one). Every limit is keyed on the account's
 * signup date: accounts created before FREE_TIER_CUTOFF keep the terms they
 * signed up under forever (LEGACY_LIMITS), accounts created on/after it get the
 * tighter POST_CUTOFF_LIMITS. Nobody's entitlement ever shrinks — the "Free
 * forever" promise on the landing page is made to every visitor, and this
 * grandfather is what keeps it honest.
 *
 * Pure and import-free on purpose: Client Components (ProgressClient,
 * LogMilestones) read these values, so this module can never touch Supabase.
 * The server resolver that reads profiles.created_at lives in the callers.
 */

/**
 * Accounts created before this instant keep LEGACY_LIMITS forever. On/after it,
 * POST_CUTOFF_LIMITS applies. This is the repositioning's deploy date — moving
 * it earlier would retroactively tighten real users (a one-way door), so it
 * only ever moves forward, and only deliberately.
 */
export const FREE_TIER_CUTOFF = '2026-08-31T00:00:00Z'

export type FreeTierLimits = {
  /** Days of diary/trends history a free user can see (today = day 1). */
  historyDays: number
  /** Weigh-in rows returned to a free user. */
  weightRows: number
  /** Meal suggestions per response for a free user. */
  suggestions: number
  /** Lifetime free AI scans (camera + chat shared pool). */
  aiScans: number
  /** Free logs before the one-time paywall interstitial fires. */
  paywallThreshold: number
}

/**
 * The terms every account that signed up before the cutoff keeps permanently —
 * and the value every hand-maintained constant held before consolidation.
 */
export const LEGACY_LIMITS: FreeTierLimits = {
  historyDays: 7,
  weightRows: 30,
  suggestions: 3,
  aiScans: 3,
  paywallThreshold: 3,
}

/**
 * New signups (on/after FREE_TIER_CUTOFF).
 *
 * - historyDays 7 → 5: still covers "log today, fix the last few days"; the core
 *   loop is untouched. 3 would leave /progress with almost nothing to draw.
 * - weightRows 30 → 14: a fortnight is a real trend, and the cap is now *named*
 *   in the UI (PR P-A) so it sells rather than confuses.
 * - paywallThreshold 3 → 2: the interstitial is dismissible and blocks nothing.
 * - suggestions / aiScans unchanged: the AI trial's scarcity is being made
 *   *visible* in a sibling PR (P-B); cutting the count in the same release would
 *   confound which lever moved conversion.
 *
 * Every one of these is a one-line revert.
 */
export const POST_CUTOFF_LIMITS: FreeTierLimits = {
  historyDays: 5,
  weightRows: 14,
  suggestions: 3,
  aiScans: 3,
  paywallThreshold: 2,
}

/**
 * Limits for an account, by signup timestamp.
 *
 * A null/unparseable createdAt returns LEGACY (generous) limits — the OPPOSITE
 * of the "unreadable tier is not Pro" convention elsewhere, and deliberately so:
 * wrongly tightening an existing user breaks the "Free forever" promise (a
 * one-way door), while wrongly loosening a new user costs a few DB rows.
 */
export function limitsForSignupDate(createdAt: string | null | undefined): FreeTierLimits {
  if (!createdAt) return LEGACY_LIMITS
  const t = new Date(createdAt).getTime()
  if (!Number.isFinite(t)) return LEGACY_LIMITS
  return t < Date.parse(FREE_TIER_CUTOFF) ? LEGACY_LIMITS : POST_CUTOFF_LIMITS
}
