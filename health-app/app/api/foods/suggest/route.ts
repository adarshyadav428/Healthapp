import { NextResponse } from 'next/server'
import { createServerClient, getAuthedUser } from '../../../../lib/supabase/server'
import { isProStatus } from '../../../../lib/subscription'
import { getIstDayRange } from '../../../../lib/dateUtils'
import { suggestMeals, FREE_SUGGESTIONS_PER_DAY } from '../../../../lib/mealSuggest'
import { captureServerEvent } from '../../../../lib/posthog/server'
import type { Food } from '../../../../types/index'

export const runtime = 'nodejs'

/**
 * The suggestion deck: what to eat with what's left of the day.
 *
 * Free users get a taste and then a wall, mirroring the AI trial — a capability
 * nobody has experienced converts badly, and this one only makes sense once
 * you've felt it answer the question.
 *
 * Candidates are drawn from measured sources first. `estimate` rows are
 * excluded entirely: they're one user's AI guess written into the shared foods
 * table, and only the user who created one should ever see it back.
 */
export async function GET() {
  const supabase = createServerClient()
  const user = await getAuthedUser(supabase)

  const { start, end } = getIstDayRange()

  const [profileResult, todayLogs, subResult, dismissedResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('daily_calorie_target, protein_g_target')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('food_logs')
      .select('kcal, protein_g')
      .eq('user_id', user.id)
      .gte('logged_at', start)
      .lt('logged_at', end),
    supabase.from('subscriptions').select('status').eq('user_id', user.id).maybeSingle(),
    supabase.from('food_dismissals').select('food_id').eq('user_id', user.id),
  ])

  const profile = profileResult.data
  if (!profile?.daily_calorie_target) {
    return NextResponse.json({ suggestions: [], reason: 'no_targets' })
  }

  const eaten = (todayLogs.data ?? []).reduce(
    (acc, l) => ({
      kcal: acc.kcal + (l.kcal as number),
      protein: acc.protein + (l.protein_g as number),
    }),
    { kcal: 0, protein: 0 }
  )

  const gap = {
    kcalRemaining: Math.round(profile.daily_calorie_target - eaten.kcal),
    proteinRemainingG: Math.max(0, Math.round((profile.protein_g_target ?? 0) - eaten.protein)),
  }

  const isPro = isProStatus(subResult.data?.status)

  // Candidate pool. Ordered by the measured sources first and capped, because
  // the ranking is in-memory: a tight unordered slice would hand back an
  // arbitrary subset of the catalogue, the same trap the food search hit.
  const { data: foods } = await supabase
    .from('foods')
    .select('id, name, brand, source, source_id, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, common_portions')
    .neq('source', 'estimate')
    .gt('kcal_per_100g', 0)
    .limit(400)

  const all = suggestMeals((foods ?? []) as unknown as Food[], gap, {
    dismissedIds: (dismissedResult.data ?? []).map((r) => r.food_id as string),
    limit: isPro ? 20 : FREE_SUGGESTIONS_PER_DAY,
  })

  captureServerEvent(user.id, 'meal_suggestions_viewed', {
    is_pro: isPro,
    kcal_remaining: gap.kcalRemaining,
    count: all.length,
  })

  return NextResponse.json({
    suggestions: all,
    gap,
    isPro,
    // Tells the deck when to show the upgrade card at the end rather than
    // simply running out, which would read as a bug.
    limited: !isPro,
  })
}

/** Left-swipe: never suggest this dish again. */
export async function POST(req: Request) {
  const supabase = createServerClient()
  const user = await getAuthedUser(supabase)

  const body = await req.json().catch(() => null)
  const foodId = body?.foodId
  if (typeof foodId !== 'string' || !foodId) {
    return NextResponse.json({ error: 'foodId is required' }, { status: 400 })
  }

  // Idempotent by the unique constraint — swiping twice is a no-op, not an error.
  const { error } = await supabase
    .from('food_dismissals')
    .upsert({ user_id: user.id, food_id: foodId }, { onConflict: 'user_id,food_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
