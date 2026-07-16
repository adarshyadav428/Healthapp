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
 * Convenience for routes that don't already fetch the subscription row in a
 * parallel Promise.all. If a route already has the row in hand, call
 * isProStatus(row?.status) directly instead of adding a second query.
 */
export async function getIsPro(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle()
  return isProStatus(data?.status)
}
