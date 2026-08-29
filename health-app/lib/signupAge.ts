import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Whole days since a signup timestamp, floored — or null if the timestamp is
 * missing or unparseable. This is the axis the growth-advice audit's
 * trial-length finding lives on (17–32 days vs ≤4), so `days_since_signup`
 * belongs on the monetization events, not just `food_logged`.
 *
 * `lib/logActivation.ts` computes the same thing inline from a row it already
 * has in hand; this helper is for the billing routes, which don't.
 */
export function daysSinceSignupFrom(
  createdAt: string | null | undefined,
  now: number = Date.now(),
): number | null {
  if (!createdAt) return null
  const t = new Date(createdAt).getTime()
  if (!Number.isFinite(t)) return null
  return Math.floor((now - t) / 86_400_000)
}

/** Reads `profiles.created_at` (written by the signup trigger) for `userId`. */
export async function daysSinceSignup(
  supabase: SupabaseClient,
  userId: string,
): Promise<number | null> {
  const { data } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', userId)
    .maybeSingle()
  return daysSinceSignupFrom((data as { created_at?: string } | null)?.created_at ?? null)
}
