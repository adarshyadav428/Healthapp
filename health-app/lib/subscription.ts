import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Single source of truth for "does this subscription status mean Pro?".
 * Every provider (Razorpay, Google Play, legacy Stripe) writes the same
 * status vocabulary to the subscriptions table, so this stays
 * provider-agnostic. Pure so it's unit-testable.
 */
export function isProStatus(status: string | null | undefined): boolean {
  return status === 'active' || status === 'trialing'
}

/**
 * Thrown by getIsPro() when the subscriptions read itself fails — as
 * distinct from a read that succeeds and finds no row (genuinely free).
 * Callers must never collapse this into "not Pro": a DB blip is not an
 * entitlement fact, and treating it as one is how a paying user gets
 * rejected by their own AI trial, streak rescue, or history window
 * (2026-09-05 adversarial-audit F2 — the same shape as the swallowed-error
 * class CLAUDE.md's hard rules already call out on the push-budget path).
 */
export class SubscriptionReadError extends Error {
  constructor() {
    super('Could not verify your subscription. Please try again.')
    this.name = 'SubscriptionReadError'
  }
}

/**
 * Convenience for routes that don't already fetch the subscription row in a
 * parallel Promise.all. If a route already has the row in hand, check
 * `error` and call isProStatus(row?.status) directly instead of adding a
 * second query.
 *
 * Throws SubscriptionReadError — never silently returns false — when the
 * read itself fails, so a caller's own error handling decides what a person
 * sees, instead of a DB blip being indistinguishable from "genuinely free".
 */
export async function getIsPro(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new SubscriptionReadError()
  return isProStatus(data?.status)
}

export type SubscriptionRow = { status: string | null; plan: string | null; provider: string | null }

/**
 * Full subscription row for the few surfaces that need more than the
 * Pro/Free boolean (currently just /welcome, for its plan/provider
 * analytics `meta`). Same fail-explicit contract as getIsPro(): throws
 * SubscriptionReadError rather than letting a failed read collapse into
 * "no subscription" (2026-09-05 adversarial-audit F2 follow-up).
 */
export async function getSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('status, plan, provider')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new SubscriptionReadError()
  return (data as SubscriptionRow | null) ?? null
}
