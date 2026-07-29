import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient, getAuthedUser } from '../../lib/supabase/server'
import { isProStatus } from '../../lib/subscription'
import { checkAiTrial } from '../../lib/aiTrialServer'
import type { FoodLog } from '../../types/index'
import { BottomNav } from '../../components/layout/BottomNav'
import { DashboardClient } from '../../components/dashboard/DashboardClient'
import { getIstDayRange, istDateStr } from '../../lib/dateUtils'
import { calculateStreakState, findStreakRescue, longestStreak } from '../../lib/streak'
import { rescuesRemaining } from '../../lib/streakRescue'
import type { WeeklyRecap } from '../../components/dashboard/WeeklyRecapCard'

export const metadata: Metadata = {
  title: 'Home — GetInShape',
  description: 'Your daily calorie snapshot.',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createServerClient()
  const user = await getAuthedUser(supabase)

  const { start, end } = getIstDayRange()

  // Streak looks back 60 days of log timestamps
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  // All three queries only need user.id — run them in one parallel round trip
  // instead of three sequential ones (each is a full network hop to Supabase).
  const [profileResult, logsResult, streakResult, subResult, recapResult, rescuesResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase
      .from('food_logs')
      .select('id, food_id, meal, grams, servings, kcal, protein_g, carbs_g, fat_g, logged_at, food:foods(id,name,kcal_per_100g,protein_g_per_100g,carbs_g_per_100g,fat_g_per_100g,serving_size_g,serving_description)')
      .eq('user_id', user.id)
      .gte('logged_at', start)
      .lt('logged_at', end)
      .order('logged_at', { ascending: false }),
    supabase
      .from('food_logs')
      .select('logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', sixtyDaysAgo),
    supabase.from('subscriptions').select('status').eq('user_id', user.id).maybeSingle(),
    // Latest weekly recap for the Pro card. Tolerant of the table not existing
    // yet (migration 024 pending) — we simply render no recap in that case.
    supabase
      .from('weekly_recaps')
      .select('avg_kcal, days_logged, weight_delta_kg, message')
      .eq('user_id', user.id)
      .order('week_start', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Pro Streak Rescues. Tolerant of migration 028 not being applied yet —
    // an error simply means no rescues exist, same as the recap query above.
    supabase.from('streak_rescues').select('rescued_date, created_at').eq('user_id', user.id),
  ])

  const { data: profile, error: profileError } = profileResult
  if (profileError) throw new Error(profileError.message)
  if (!profile || profile.height_cm === null) redirect('/onboarding')

  const { data: rawLogs, error: logsError } = logsResult
  if (logsError) throw new Error(logsError.message)

  const { data: recentLogs } = streakResult

  // Freeze-aware: a missed day covered by a banked freeze keeps the streak
  // alive here, so the number the user sees matches the rules we tell them.
  // Rescued days bridge breaks the user paid to repair. Passed IN so
  // calculateStreakState stays pure — see the note on it in lib/streak.ts.
  const rescueRows = rescuesResult.data ?? []
  const rescuedDates = rescueRows.map((r) => r.rescued_date as string)

  const streakState = calculateStreakState(
    (recentLogs ?? []) as unknown as FoodLog[],
    new Date(),
    rescuedDates
  )
  const streakDays = streakState.streak

  // Feeds the "next badge" nudge. Free — it reuses the 60-day window already
  // fetched for the streak, and is the same window the badge shelf on Trends
  // derives from, so the two can't disagree about what's been earned.
  const bestStreak = longestStreak((recentLogs ?? []) as unknown as FoodLog[])

  // IST date keys with at least one log — feeds the week strip's dots, matching
  // /log's IST ?date= semantics (a 1am-IST log belongs to that IST day).
  const loggedDates = Array.from(
    new Set((recentLogs ?? []).map((r) => istDateStr(new Date(String(r.logged_at)))))
  )

  const foodLogs = (rawLogs ?? []) as unknown as FoodLog[]

  const sub = subResult.data
  const isPro = isProStatus(sub?.status)

  // Free users get a small lifetime AI trial once their email is verified. The
  // FAB needs this so it doesn't bounce someone to the paywall who still has
  // scans left. Pro skips the query entirely — it can't be gated.
  const aiTrial = isPro ? null : await checkAiTrial(supabase, user.id)
  const aiTrialRemaining = aiTrial?.allowed ? aiTrial.remaining : 0

  // The rescue offer. Only computed for Pro — showing a free user a repairable
  // break they can't act on is an advert dressed as a feature, and the streak
  // is otherwise entirely free territory.
  const rescueOffer =
    isPro && rescuesRemaining(rescueRows.map((r) => r.created_at as string)) > 0
      ? findStreakRescue((recentLogs ?? []) as unknown as FoodLog[], new Date(), rescuedDates)
      : null

  const recapRow = recapResult.data
  const weeklyRecap: WeeklyRecap | null = recapRow
    ? {
        daysLogged: recapRow.days_logged as number,
        avgKcal: recapRow.avg_kcal as number,
        weightDeltaKg: (recapRow.weight_delta_kg as number | null) ?? null,
        message: recapRow.message as string,
      }
    : null

  return (
    // Transparent: the body paints canvas + the ambient light field
    <div className="min-h-screen">
      <main
        className="relative mx-auto w-full max-w-md px-6"
        style={{
          paddingTop: 'calc(20px + env(safe-area-inset-top))',
          paddingBottom: 'calc(120px + env(safe-area-inset-bottom))',
        }}
      >
        <DashboardClient
          profile={profile}
          initialLogs={foodLogs}
          streakDays={streakDays}
          longestStreakDays={bestStreak}
          freezesBanked={streakState.freezesBanked}
          loggedDates={loggedDates}
          isPro={isPro}
          aiTrialRemaining={aiTrialRemaining}
          weeklyRecap={weeklyRecap}
          rescueOffer={rescueOffer}
        />
      </main>
      <BottomNav />
    </div>
  )
}
