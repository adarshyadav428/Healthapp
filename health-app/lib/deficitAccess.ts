import { FREE_TIER_CUTOFF } from './freeTier'

/**
 * Access rules for the calorie-deficit surface (/deficit).
 *
 * Product decision (pricing repositioning, PR C2): /deficit becomes a Pro
 * feature, but a post-cutoff free account gets a short taste window first.
 * Accounts that signed up before FREE_TIER_CUTOFF joined under the "Free
 * forever" promise and keep /deficit free permanently.
 *
 * Pure and importing only from ./freeTier so Client and Server components can
 * both read it. `now` is injectable for tests.
 */

/** A post-cutoff free account can see /deficit for this many days after signup. */
export const DEFICIT_TASTE_DAYS = 3

export type DeficitAccess =
  | { allowed: true }
  | { allowed: false; reason: 'taste_expired' }

/**
 * Who can see the calorie-deficit surface.
 *
 * - Pro: always.
 * - Signed up before FREE_TIER_CUTOFF: always (grandfathered — /deficit was
 *   free when they joined and the "Free forever" promise holds).
 * - Signed up on/after the cutoff: free for DEFICIT_TASTE_DAYS after signup,
 *   then Pro-only. A time-limited taste, not a permanent free feature.
 * - Unknown/unparseable createdAt: allow (fail open — same rationale as
 *   lib/freeTier.ts: wrongly locking a real user is the costly mistake).
 */
export function deficitAccess(args: {
  isPro: boolean
  createdAt: string | null | undefined
  now?: number
}): DeficitAccess {
  const { isPro, createdAt, now = Date.now() } = args
  if (isPro) return { allowed: true }
  if (!createdAt) return { allowed: true }
  const created = new Date(createdAt).getTime()
  if (!Number.isFinite(created)) return { allowed: true }
  if (created < Date.parse(FREE_TIER_CUTOFF)) return { allowed: true }
  const ageDays = (now - created) / 86_400_000
  return ageDays < DEFICIT_TASTE_DAYS
    ? { allowed: true }
    : { allowed: false, reason: 'taste_expired' }
}
