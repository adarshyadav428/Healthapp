/**
 * The free AI trial: a small, one-time taste of the Pro feature.
 *
 * AI photo scan and AI chat logging are Pro-only (see the routes). But the scan
 * IS the product's wow moment, and a paywall in front of something the user has
 * never experienced converts badly — they're being asked to pay for a promise.
 * So every account gets a handful of lifetime AI calls before the wall goes up.
 *
 * Two deliberate shapes:
 *
 * 1. LIFETIME, not per-day. A daily allowance is an uncapped bill (5 x users x
 *    days, forever); a lifetime one costs at most N x signups and is a number we
 *    can actually forecast.
 *
 * 2. VERIFIED EMAIL REQUIRED. Signup no longer proves the address, so without
 *    this the trial is farmable to infinity — burn 3 scans, sign up again with
 *    another junk address, repeat. Requiring a real inbox puts a cost on the
 *    second account. It also gives the verification prompt a reason the user
 *    actually cares about ("confirm to unlock 3 free AI scans") rather than a
 *    housekeeping request they'll ignore.
 *
 * This module is deliberately dependency-free so client components can import
 * the constant and copy without pulling server code into the bundle. The DB
 * side lives in ./aiTrialServer.
 */
import { LEGACY_LIMITS } from './freeTier'

export const AI_TRIAL_SCANS = LEGACY_LIMITS.aiScans

/** Why a non-Pro user was refused. Drives paywall copy and the funnel prop. */
export type AiTrialBlock = 'unverified' | 'exhausted'

export type AiTrialDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; block: AiTrialBlock }

/**
 * The gate itself, as a pure function so the rules are testable without a DB.
 *
 * Order matters: an unverified user is told to verify even if their count is
 * already at the limit, because verifying is the action that could help them.
 * (They can only have a non-zero count from a period when they were verified,
 * or from the pre-trial era — either way "you've used them up" is the wrong
 * next step to show someone whose email isn't confirmed.)
 */
export function decideAiTrial(args: {
  emailVerifiedAt: string | null
  usedCount: number
  limit?: number
}): AiTrialDecision {
  const limit = args.limit ?? AI_TRIAL_SCANS
  if (!args.emailVerifiedAt) return { allowed: false, block: 'unverified' }
  const remaining = limit - args.usedCount
  if (remaining <= 0) return { allowed: false, block: 'exhausted' }
  return { allowed: true, remaining }
}
