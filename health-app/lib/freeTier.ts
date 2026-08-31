/**
 * The single source of truth for every free-tier limit.
 *
 * Consolidates eleven hand-maintained copies (two already provably duplicated,
 * one already off-by-one). Every limit is keyed on the account's signup date so
 * a future change can tighten NEW users without touching anyone who signed up
 * under the current terms — but C1 ships every post-cutoff limit IDENTICAL to
 * today's, so this file is a pure refactor. tests/routeEntitlements.test.ts
 * passing unedited is the proof.
 *
 * Pure and import-free on purpose: Client Components (ProgressClient,
 * LogMilestones) read these values, so this module can never touch Supabase.
 * The server resolver that reads profiles.created_at lives in the callers.
 */

/** Accounts created before this keep the limits below forever. */
export const FREE_TIER_CUTOFF = '2099-01-01T00:00:00Z' // placeholder — the real deploy date is set in C2

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

/** Today's limits — the values every current constant already holds. */
export const LEGACY_LIMITS: FreeTierLimits = {
  historyDays: 7,
  weightRows: 30,
  suggestions: 3,
  aiScans: 3,
  paywallThreshold: 3,
}

/** C1: identical to LEGACY. C2 flips these. */
export const POST_CUTOFF_LIMITS: FreeTierLimits = { ...LEGACY_LIMITS }

/**
 * Limits for an account, by signup timestamp.
 *
 * A null/unparseable createdAt returns LEGACY (generous) limits — the OPPOSITE
 * of the "unreadable tier is not Pro" convention elsewhere, and deliberately so:
 * wrongly tightening an existing user breaks the "Free forever" promise (a
 * one-way door), while wrongly loosening a new user costs a few DB rows.
 *
 * C1: every path returns LEGACY_LIMITS. The cutoff comparison is wired but
 * inert because POST_CUTOFF_LIMITS === LEGACY_LIMITS until C2.
 */
export function limitsForSignupDate(createdAt: string | null | undefined): FreeTierLimits {
  if (!createdAt) return LEGACY_LIMITS
  const t = new Date(createdAt).getTime()
  if (!Number.isFinite(t)) return LEGACY_LIMITS
  return t < Date.parse(FREE_TIER_CUTOFF) ? LEGACY_LIMITS : POST_CUTOFF_LIMITS
}
