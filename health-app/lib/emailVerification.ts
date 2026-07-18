/**
 * Gating for the "confirm your email" nudge.
 *
 * The product intent is deliberate: signup no longer blocks on an inbox round
 * trip, so people get into the app immediately — and we chase proof of
 * ownership later, once they've had time to decide the app is worth keeping.
 * Asking on day zero would just reinstate the wall we removed.
 *
 * Pure so it's testable; the component owns localStorage and the network call.
 */

/** How long to let someone explore before asking them to prove their address. */
// TEMPORARY — set to 0 for manual testing on a fresh account. RESTORE TO 3.
export const VERIFY_PROMPT_GRACE_DAYS = 0

/** Cooldown after a "Not now", so the card nudges rather than nags. */
export const VERIFY_PROMPT_COOLDOWN_DAYS = 7

export type VerifyPromptState = {
  /** ISO timestamp of the last "Not now". */
  lastDismissedAt?: string
} | null

export function shouldPromptEmailVerification(args: {
  /** profiles.email_verified_at — null means unproven. */
  emailVerifiedAt: string | null
  /** profiles.created_at — how long they've had to explore. */
  accountCreatedAt: string | null
  state: VerifyPromptState
  now?: Date
}): boolean {
  const { emailVerifiedAt, accountCreatedAt, state, now = new Date() } = args

  // Already proven — never ask again.
  if (emailVerifiedAt) return false

  // Without a creation date we can't tell whether the grace period has passed.
  // Stay quiet: a missed nudge is recoverable, a nag on first launch is the
  // exact friction this whole change exists to remove.
  if (!accountCreatedAt) return false
  const created = new Date(accountCreatedAt).getTime()
  if (!Number.isFinite(created)) return false

  const ageDays = (now.getTime() - created) / 86_400_000
  if (ageDays < VERIFY_PROMPT_GRACE_DAYS) return false

  if (state?.lastDismissedAt) {
    const dismissed = new Date(state.lastDismissedAt).getTime()
    if (Number.isFinite(dismissed)) {
      const since = (now.getTime() - dismissed) / 86_400_000
      if (since < VERIFY_PROMPT_COOLDOWN_DAYS) return false
    }
  }

  return true
}

/** Parse the stored JSON defensively — malformed data counts as "no state". */
export function parseVerifyPromptState(raw: string | null): VerifyPromptState {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed as VerifyPromptState
    return null
  } catch {
    return null
  }
}
