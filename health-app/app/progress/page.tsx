import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient, getAuthedUser } from '../../lib/supabase/server'
import { isProStatus } from '../../lib/subscription'
import type { FoodLog, WeightLog } from '../../types/index'
import { calculateStreakState, longestStreak } from '../../lib/streak'
import { istDateStr } from '../../lib/dateUtils'
import { BottomNav } from '../../components/layout/BottomNav'
import { ProgressClient } from '../../components/progress/ProgressClient'

export const metadata: Metadata = {
  title: 'Trends — GetInShape',
  description: 'Your weight trend, streaks and nutrition history.',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

export default async function ProgressPage() {
  const supabase = createServerClient()
  const user = await getAuthedUser(supabase)

  // Streak always looks back 60 days regardless of Pro status — it's a free,
  // always-on stat, independent of the Pro-gated trend-history depth below.
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60)

  // Free → 7 days, Pro → 90 days of trend/macro history. We don't know Pro
  // status until the subscriptions query resolves, so fetch the full 90-day
  // window in the same parallel round trip and trim to 7 days afterwards for
  // free users — one network stage instead of three sequential ones.
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - 90)

  const [profileResult, subResult, streakResult, weightResult, logsResult, exerciseResult, logCountResult, weighInCountResult, savedMealCountResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('food_logs')
      .select('logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', sixtyDaysAgo.toISOString()),
    supabase
      .from('weight_logs')
      .select('id, weight_kg, measured_at, notes')
      .eq('user_id', user.id)
      .order('measured_at', { ascending: false })
      .limit(30),
    supabase
      .from('food_logs')
      .select('logged_at, kcal, protein_g, carbs_g, fat_g, meal')
      .eq('user_id', user.id)
      .gte('logged_at', cutoff.toISOString())
      .order('logged_at', { ascending: true }),
    supabase
      .from('exercise_logs')
      .select('logged_at, activity, duration_min, calories')
      .eq('user_id', user.id)
      .gte('logged_at', cutoff.toISOString())
      .order('logged_at', { ascending: false }),
    // Badge counters — head-only counts, so no rows cross the wire.
    supabase.from('food_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('weight_logs').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('saved_meals').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  const { data: profile, error: profileError } = profileResult
  if (profileError) throw new Error(profileError.message)
  if (!profile || profile.height_cm === null) redirect('/onboarding')

  // Pro status — free users only see the last 7 days of trend history
  const sub = subResult.data
  const isPro = isProStatus(sub?.status)

  if (logsResult.error) throw new Error(logsResult.error.message)

  // Trim the 90-day fetch down to the free-tier window before anything is
  // passed to the client — free users receive exactly the same 7 days as before.
  const freeCutoff = new Date()
  freeCutoff.setUTCDate(freeCutoff.getUTCDate() - 7)
  const freeCutoffMs = freeCutoff.getTime()
  const withinTier = <T extends { logged_at: string }>(rows: T[]) =>
    isPro ? rows : rows.filter((r) => new Date(r.logged_at).getTime() >= freeCutoffMs)

  const streak      = calculateStreakState((streakResult.data ?? []) as unknown as FoodLog[]).streak
  const weightLogs  = (weightResult.data ?? []) as unknown as WeightLog[]
  const loggedDates = (streakResult.data ?? []).map((r) => r.logged_at as string)
  const logs        = withinTier(logsResult.data ?? [])
  // Exercise logs are optional — table may not exist yet
  const exerciseLogs = exerciseResult.error ? [] : withinTier(exerciseResult.data ?? [])

  // ── Badge stats ─────────────────────────────────────────────────────────────
  // Badges are free and lifetime, so they read the UNTRIMMED log window — the
  // Pro history gate limits what you can browse, not what you've achieved.
  const allRecentLogs = logsResult.data ?? []
  const proteinTarget = profile.protein_g_target ?? 0
  const proteinByDay = new Map<string, number>()
  for (const row of allRecentLogs) {
    const day = istDateStr(new Date(String(row.logged_at)))
    proteinByDay.set(day, (proteinByDay.get(day) ?? 0) + (row.protein_g ?? 0))
  }
  const proteinTargetDaysHit = proteinTarget > 0
    ? [...proteinByDay.values()].filter((g) => g >= proteinTarget).length
    : 0

  const badgeStartWeight = profile.start_weight_kg ?? weightLogs[weightLogs.length - 1]?.weight_kg ?? null
  const badgeCurrentWeight = weightLogs[0]?.weight_kg ?? profile.current_weight_kg ?? null

  const badgeStats = {
    totalLogs: logCountResult.count ?? 0,
    currentStreak: streak,
    longestStreak: longestStreak((streakResult.data ?? []) as unknown as FoodLog[]),
    proteinTargetDaysHit,
    weighIns: weighInCountResult.count ?? 0,
    savedMealTemplates: savedMealCountResult.count ?? 0,
    kgLost: badgeStartWeight != null && badgeCurrentWeight != null
      ? badgeStartWeight - badgeCurrentWeight
      : null,
  }

  return (
    <div className="min-h-screen">
      <main
        className="mx-auto w-full max-w-md px-6"
        style={{
          paddingTop: 'calc(20px + env(safe-area-inset-top))',
          paddingBottom: 'calc(120px + env(safe-area-inset-bottom))',
        }}
      >
        <ProgressClient
          streak={streak}
          weightLogs={weightLogs}
          loggedDates={loggedDates}
          logs={logs}
          exerciseLogs={exerciseLogs}
          profile={profile}
          isPro={isPro}
          badgeStats={badgeStats}
        />
      </main>
      <BottomNav />
    </div>
  )
}
