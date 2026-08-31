'use client'

/**
 * The one localStorage wrapper for the "confirm your email" nudge state.
 *
 * `lib/emailVerification.ts` stays pure (it owns the *decision*); this owns the
 * *storage*, shared between VerifyEmailCard (which reads it and writes
 * `lastDismissedAt`) and the AI hooks (which write `aiGateBlockedAt` when a scan
 * is refused for lack of a verified email).
 */

import { parseVerifyPromptState, type VerifyPromptState } from './emailVerification'

const storageKey = (uid: string) => `gis.verifyEmail.${uid}`

export function readVerifyPromptState(uid: string): VerifyPromptState {
  try {
    return parseVerifyPromptState(localStorage.getItem(storageKey(uid)))
  } catch {
    return null
  }
}

export function patchVerifyPromptState(
  uid: string,
  patch: Partial<NonNullable<VerifyPromptState>>,
): void {
  try {
    const prev = readVerifyPromptState(uid)
    localStorage.setItem(storageKey(uid), JSON.stringify({ ...prev, ...patch }))
  } catch {
    /* noop — worst case we ask again */
  }
}

/** An AI gate refused this user for lack of a verified email — surface the card now. */
export function recordAiVerificationBlock(uid: string): void {
  patchVerifyPromptState(uid, { aiGateBlockedAt: new Date().toISOString() })
}
