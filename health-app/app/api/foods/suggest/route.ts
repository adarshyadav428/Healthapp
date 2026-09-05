import { NextResponse } from 'next/server'
import { createServerClient, getAuthedUser } from '../../../../lib/supabase/server'
import { getIsPro, SubscriptionReadError } from '../../../../lib/subscription'
import { getIstDayRange } from '../../../../lib/dateUtils'
import { suggestMeals } from '../../../../lib/mealSuggest'
import { limitsForSignupDate } from '../../../../lib/freeTier'
import { captureServerEvent } from '../../../../lib/posthog/server'
import type { Food } from '../../../../types/index'

export const runtime = 'nodejs'

const POOL_COLUMNS =
  'id, name, brand, source, source_id, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, common_portions'

/**
 * The two tiers are defined by *exclusion*, not by listing the measured source
 * names. `SOURCE_RANK` (lib/foodMatch.ts) knows six of them today, but a source
 * added to the table and not to a hardcoded list here would silently vanish
 * from every suggestion — a worse bug than the one being fixed. Excluding
 * `curated` and `estimate` keeps the pool exactly as inclusive as the single
 * query it replaces.
 *
 * `estimate` stays out entirely, as everywhere else: those rows are one user's
 * AI guess written into the shared table, and only their author should see them.
 *
 * `user` (Pro-only custom foods, created via /api/foods/custom) is excluded
 * for the identical reason, and it's the one this comment used to miss:
 * `foods_select` RLS is open to every signed-in user for the shared
 * catalogue, so without this a private custom food could be suggested — id,
 * name and macros — to a completely different account, no name collision or
 * known food_id required. Audit 2026-09-04 (P0-2 follow-up).
 */
const NON_MEASURED = '("curated","estimate","user")'
const POOL_SIZE = 400

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

  let profileResult, todayLogs, isPro, dismissedResult
  try {
    ;[profileResult, todayLogs, isPro, dismissedResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('daily_calorie_target, protein_g_target, created_at')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('food_logs')
        .select('kcal, protein_g')
        .eq('user_id', user.id)
        .gte('logged_at', start)
        .lt('logged_at', end),
      // getIsPro throws on a failed read rather than silently returning
      // false — a DB blip must never look like "genuinely free" here.
      // 2026-09-05 adversarial-audit F2.
      getIsPro(supabase, user.id),
      supabase.from('food_dismissals').select('food_id').eq('user_id', user.id),
    ])
  } catch (err) {
    if (err instanceof SubscriptionReadError) {
      return NextResponse.json({ error: err.message }, { status: 500 })
    }
    throw err
  }

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

  // Candidate pool. This comment used to claim the pool was "ordered by the
  // measured sources first and capped" — there was no `.order()` in the file at
  // all, and Postgres applies LIMIT before any sort, so `suggestMeals` ranked an
  // arbitrary 400 rows: measured IFCT staples could be absent entirely, and the
  // set drifted as `foods` grew or after a VACUUM. Exactly the trap the food
  // search hit, described accurately and then not implemented (P2-2).
  //
  // Two ordered reads rather than one, because PostgREST cannot ORDER BY a CASE
  // and `source` sorts alphabetically — which would put `curated` (category
  // estimates) above `ifct` (measured), the wrong way round. The measured tier
  // is read first and in full; `curated` only fills what is left, which is what
  // SOURCE_RANK means in `lib/foodMatch.ts`. `.order('id')` is arbitrary but
  // *stable*: the same account gets the same pool tomorrow.
  const [measuredRes, curatedRes] = await Promise.all([
    supabase
      .from('foods')
      .select(POOL_COLUMNS)
      .not('source', 'in', NON_MEASURED)
      .gt('kcal_per_100g', 0)
      .order('id')
      .limit(POOL_SIZE),
    supabase
      .from('foods')
      .select(POOL_COLUMNS)
      .eq('source', 'curated')
      .gt('kcal_per_100g', 0)
      .order('id')
      .limit(POOL_SIZE),
  ])

  // Not swallowed. An unreadable catalogue is indistinguishable from an empty
  // one here, and "no suggestions" is a plausible-looking answer — the failure
  // mode this codebase keeps re-learning.
  if (measuredRes.error || curatedRes.error) {
    return NextResponse.json({ error: 'Could not load suggestions' }, { status: 500 })
  }

  const foods = [...(measuredRes.data ?? []), ...(curatedRes.data ?? [])].slice(0, POOL_SIZE)

  const all = suggestMeals((foods ?? []) as unknown as Food[], gap, {
    dismissedIds: (dismissedResult.data ?? []).map((r) => r.food_id as string),
    limit: isPro ? 20 : limitsForSignupDate(profile?.created_at).suggestions,
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
  //
  // ignoreDuplicates is load-bearing, not a tidiness flag. Without it supabase-js
  // sends Prefer: resolution=merge-duplicates, which is INSERT ... ON CONFLICT DO
  // UPDATE — and migration 030 gave food_dismissals select/insert/delete policies
  // but no UPDATE policy. Under RLS "no policy" means denied, so the second swipe
  // of the same dish would fail 42501 and this route would answer 500 for what the
  // line above calls a no-op. That is exactly the shape of the 2026-07-31 audit's
  // P1-1 (push_subscriptions). Resolving to DO NOTHING needs only INSERT, and
  // there is nothing in the row worth rewriting anyway.
  // Pinned by tests/rlsPolicies.test.ts.
  const { error } = await supabase
    .from('food_dismissals')
    .upsert(
      { user_id: user.id, food_id: foodId },
      { onConflict: 'user_id,food_id', ignoreDuplicates: true }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
