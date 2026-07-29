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

  const cards = buildPlanCards({
    firstName: profile.display_name?.trim().split(/\s+/)[0] ?? null,
    dailyCalorieTarget: profile.daily_calorie_target,
    proteinTargetG: profile.protein_g_target ?? 0,
    goal: profile.goal,
    currentWeightKg: profile.current_weight_kg,
    targetWeightKg: profile.target_weight_kg,
    paceKgPerWeek: profile.pace_kg_per_week ?? null,
  })

  return (
    <StorySurface
      surface="onboarding_plan"
      cards={cards}
      ctaLabel="Log my first meal"
      ctaHref="/log"
      exitHref="/dashboard"
      meta={{ goal: profile.goal }}
    />
  )
}
