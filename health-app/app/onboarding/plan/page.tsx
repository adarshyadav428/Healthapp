import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient, getAuthedUser } from '../../../lib/supabase/server'
import { buildPlanCards } from '../../../lib/planCards'
import { StorySurface } from '../../../components/story/StorySurface'

export const metadata: Metadata = {
  title: 'Your plan — GetInShape',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

/**
 * The first thing a new account sees after onboarding.
 *
 * It replaces a 1.6s confetti overlay, which congratulated someone for filling
 * in a form rather than handing them what the form was for. At current scale
 * the binding constraint is activation — signups who never log a meal — and
 * this is the gap between "I answered six questions" and "I know what to do
 * tomorrow".
 */
export default async function OnboardingPlanPage() {
  const supabase = createServerClient()
  const user = await getAuthedUser(supabase)

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, daily_calorie_target, protein_g_target, goal, current_weight_kg, target_weight_kg, pace_kg_per_week')
    .eq('id', user.id)
    .maybeSingle()

  // Reaching here without a finished profile means onboarding didn't actually
  // complete — send them back rather than showing a plan built from nulls.
  if (!profile || !profile.daily_calorie_target) redirect('/onboarding')

  // The personalising answers (migration 039) are fetched separately and
  // best-effort, matching how app/api/onboarding/route.ts writes them.
  // Deliberately NOT folded into the select above: migrations here are applied
  // by hand, and naming an unapplied column makes the whole select fail — which
  // would null the profile, trip the redirect on the line above and bounce a
  // user who has just finished onboarding straight back into it, forever.
  // These two only change wording, so failing to read them must cost nothing.
  let obstacles: string[] | null = null
  let trackingExperience: string | null = null
  try {
    const { data: extra } = await supabase
      .from('profiles')
      .select('obstacles, tracking_experience')
      .eq('id', user.id)
      .maybeSingle()
    obstacles = extra?.obstacles ?? null
    trackingExperience = extra?.tracking_experience ?? null
  } catch { /* 039 not applied yet — the story reads fine without them */ }

  const cards = buildPlanCards({
    firstName: profile.display_name?.trim().split(/\s+/)[0] ?? null,
    dailyCalorieTarget: profile.daily_calorie_target,
    proteinTargetG: profile.protein_g_target ?? 0,
    goal: profile.goal,
    currentWeightKg: profile.current_weight_kg,
    targetWeightKg: profile.target_weight_kg,
    paceKgPerWeek: profile.pace_kg_per_week ?? null,
    obstacles,
    trackingExperience,
  })

  return (
    <StorySurface
      surface="onboarding_plan"
      cards={cards}
      ctaLabel="Log my first meal"
      ctaHref="/log"
      // ✕ used to go to /dashboard. This page exists because the binding
      // constraint is activation — signups who never log a meal — and sending
      // the people who skip the story to a dashboard full of zeroes is the
      // exact leak it was built to close. Both exits now lead to logging.
      exitHref="/log"
      meta={{
        goal: profile.goal,
        // So the funnel can answer whether the two added screens paid for
        // themselves: does a personalised plan finish and convert better?
        obstacle_count: obstacles?.length ?? 0,
        tracking_experience: trackingExperience ?? 'skipped',
      }}
    />
  )
}
