import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient, getAuthedUser } from '../../lib/supabase/server'
import { isProStatus } from '../../lib/subscription'
import { countAiTrialUsage } from '../../lib/aiTrialServer'
import { computeWrappedStats } from '../../lib/wrappedStats'
import { buildWelcomeCards } from '../../lib/welcomeCards'
import { StorySurface } from '../../components/story/StorySurface'
import type { FoodLog } from '../../types/index'

export const metadata: Metadata = {
  title: 'Welcome to Pro — GetInShape',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

/**
 * The moment after paying.
 *
 * Before this existed, the entire reward for a ₹299 subscription was a 2.5s
 * toast and a redirect back to the same dashboard — five of Pro's six benefits
 * are walls coming down, and a wall coming down is invisible until the next
 * time you'd have hit it. This is the one screen that makes the purchase felt.
 *
 * Everything is computed server-side and passed down as plain data: the peak
 * emotional moment of the product is the worst possible place for a client
 * fetch that can hang on a patchy connection.
 */
export default async function WelcomePage() {
  const supabase = createServerClient()
  const user = await getAuthedUser(supabase)

  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  const [subResult, profileResult, logsResult, weightsResult, aiScans] = await Promise.all([
    supabase.from('subscriptions').select('status, plan, provider').eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
    supabase
      .from('food_logs')
      .select('kcal, protein_g, logged_at, food:foods(name)')
      .eq('user_id', user.id)
      .gte('logged_at', sixtyDaysAgo),
    supabase
      .from('weight_logs')
      .select('weight_kg, measured_at')
      .eq('user_id', user.id)
      .order('measured_at', { ascending: true }),
    countAiTrialUsage(supabase, user.id),
  ])

  const sub = subResult.data

  // Gate on the entitlement, not on how they arrived. `trialing` counts: inside
  // the TWA, Play grants a 3-day trial and the money doesn't move until it
  // ends — waiting for a captured payment would mean trial users, the ones
  // most in need of a reason to stay, never see this at all.
  if (!isProStatus(sub?.status)) redirect('/upgrade')

  const stats = computeWrappedStats({
    logs: (logsResult.data ?? []) as unknown as FoodLog[],
    weighIns: weightsResult.data ?? [],
    // Protein days aren't shown on this sequence, so the target isn't fetched.
    proteinTargetG: null,
    aiScans: aiScans ?? 0,
  })

  // Anonymous accounts (migration 026) have no email and often no display name;
  // `buildWelcomeCards` falls back to an unnamed greeting rather than "Pro, .".
  const firstName = profileResult.data?.display_name?.trim().split(/\s+/)[0] ?? null

  const cards = buildWelcomeCards({
    stats,
    firstName,
    // A brand-new Pro has spent at most the free allowance; a long-time Pro
    // returning here has spent far more. The card clamps to the allowance.
    aiTrialUsed: aiScans ?? 0,
  })

  return (
    <StorySurface
      surface="welcome"
      cards={cards}
      ctaLabel="Scan a meal"
      ctaHref="/dashboard?scan=1"
      exitHref="/dashboard"
      meta={{ plan: sub?.plan ?? null, provider: sub?.provider ?? null, has_story: stats.hasStory }}
    />
  )
}
