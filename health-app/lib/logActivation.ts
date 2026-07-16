import type { SupabaseClient } from '@supabase/supabase-js'
import { isProStatus } from './subscription'
import type { LogMilestone } from './logMilestones'

/**
 * Cheap enrichment for the meal_logged event: whether this is the user's
 * true first-ever log (decoupled from meal_logged firing on every log), and
 * how many days since they signed up. Filtering/segmenting meal_logged on
 * these properties covers D1/D7/D30 retention analysis directly — no
 * separate "returned and logged" event needed, and it also works as the
 * returning-event in PostHog's own Retention insight against
 * user_signed_up.
 *
 * Signup date comes from profiles.created_at (written by the signup trigger)
 * rather than the auth User object — the log routes verify the JWT locally
 * and no longer have a full User in hand. All three queries run in parallel,
 * so this costs no extra wall time.
 *
 * total_logs_before/is_pro additionally feed the `milestone` field on log
 * responses (see toLogMilestone) that drives the client's first-log
 * celebration and one-time paywall interstitial.
 */
export type LogActivationContext = {
  is_first_log: boolean
  days_since_signup: number | null
  total_logs_before: number
  is_pro: boolean
}

export async function getLogActivationContext(
  supabase: SupabaseClient,
  userId: string
): Promise<LogActivationContext> {
  const [{ count }, { data: profileRow }, { data: subRow }] = await Promise.all([
    supabase
      .from('food_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase.from('profiles').select('created_at').eq('id', userId).maybeSingle(),
    supabase.from('subscriptions').select('status').eq('user_id', userId).maybeSingle(),
  ])

  const daysSinceSignup = profileRow?.created_at
    ? Math.floor((Date.now() - new Date(profileRow.created_at).getTime()) / 86_400_000)
    : null

  return {
    is_first_log: (count ?? 0) === 0,
    days_since_signup: daysSinceSignup,
    total_logs_before: count ?? 0,
    is_pro: isProStatus(subRow?.status),
  }
}

/**
 * The `milestone` field every successful log response carries — computed
 * from the pre-insert context plus how many rows the route just inserted.
 */
export function toLogMilestone(
  activation: LogActivationContext,
  insertedCount: number
): LogMilestone {
  return {
    isFirstLog: activation.is_first_log,
    totalLogs: activation.total_logs_before + insertedCount,
    isPro: activation.is_pro,
  }
}
