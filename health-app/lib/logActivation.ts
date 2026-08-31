import type { SupabaseClient } from '@supabase/supabase-js'
import { isProStatus } from './subscription'
import { limitsForSignupDate } from './freeTier'
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
  /**
   * Raw profiles.created_at — the same value days_since_signup is derived from,
   * kept unrounded so toLogMilestone can resolve the account's per-cohort
   * free-tier limits (limitsForSignupDate).
   */
  created_at: string | null
  total_logs_before: number
  is_pro: boolean
  /**
   * The user's logged_at history as it stood BEFORE this log, windowed to the
   * last 60 days — enough for calculateStreakState, which never looks further
   * back than the current run. Feeds lib/streakEvents.ts, the only way the
   * streak (recomputed pure from logs everywhere else) can announce a change.
   */
  logs_before: { logged_at: string }[]
  /**
   * IST date keys a Pro Streak Rescue already covered. calculateStreakState
   * takes these as an argument rather than reading them, so they have to be
   * fetched alongside — without them a rescued day looks like a break and the
   * streak number on the events would be wrong for exactly the paying users.
   */
  rescued_dates: string[]
}

export async function getLogActivationContext(
  supabase: SupabaseClient,
  userId: string
): Promise<LogActivationContext> {
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString()

  const [{ count }, { data: profileRow }, { data: subRow }, { data: logRows }, { data: rescueRows }] = await Promise.all([
    supabase
      .from('food_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase.from('profiles').select('created_at').eq('id', userId).maybeSingle(),
    supabase.from('subscriptions').select('status').eq('user_id', userId).maybeSingle(),
    // logged_at only, and only 60 days: this runs on every log, so it has to
    // stay a narrow indexed read rather than pulling joined food rows.
    supabase
      .from('food_logs')
      .select('logged_at')
      .eq('user_id', userId)
      .gte('logged_at', sixtyDaysAgo),
    supabase.from('streak_rescues').select('rescued_date').eq('user_id', userId),
  ])

  const daysSinceSignup = profileRow?.created_at
    ? Math.floor((Date.now() - new Date(profileRow.created_at).getTime()) / 86_400_000)
    : null

  return {
    is_first_log: (count ?? 0) === 0,
    days_since_signup: daysSinceSignup,
    created_at: (profileRow?.created_at as string | null) ?? null,
    total_logs_before: count ?? 0,
    is_pro: isProStatus(subRow?.status),
    logs_before: (logRows ?? []) as { logged_at: string }[],
    rescued_dates: (rescueRows ?? []).map((r) => (r as { rescued_date: string }).rescued_date),
  }
}

/**
 * The `milestone` field every successful log response carries — computed
 * from the pre-insert context plus how many rows the route just inserted.
 *
 * `paywallThreshold` is resolved here, server-side, from the account's signup
 * cohort (limitsForSignupDate) and rides on the wire so getLogMilestoneAction —
 * which runs on the client — never reads a module constant that can't vary per
 * user. Pre-cutoff accounts get 3; post-cutoff get 2.
 */
export function toLogMilestone(
  activation: LogActivationContext,
  insertedCount: number
): LogMilestone {
  return {
    isFirstLog: activation.is_first_log,
    totalLogs: activation.total_logs_before + insertedCount,
    isPro: activation.is_pro,
    paywallThreshold: limitsForSignupDate(activation.created_at).paywallThreshold,
  }
}
