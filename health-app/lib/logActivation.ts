import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * Cheap enrichment for the meal_logged event: whether this is the user's
 * true first-ever log (decoupled from meal_logged firing on every log), and
 * how many days since they signed up. Filtering/segmenting meal_logged on
 * these properties covers D1/D7/D30 retention analysis directly — no
 * separate "returned and logged" event needed, and it also works as the
 * returning-event in PostHog's own Retention insight against
 * user_signed_up.
 */
export async function getLogActivationContext(
  supabase: SupabaseClient,
  user: User
): Promise<{ is_first_log: boolean; days_since_signup: number | null }> {
  const { count } = await supabase
    .from('food_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const daysSinceSignup = user.created_at
    ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86_400_000)
    : null

  return { is_first_log: (count ?? 0) === 0, days_since_signup: daysSinceSignup }
}
