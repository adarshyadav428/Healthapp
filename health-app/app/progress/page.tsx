import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient, getAuthedUser } from '../../lib/supabase/server'
import { isProStatus } from '../../lib/subscription'
import { limitsForSignupDate } from '../../lib/freeTier'
import type { FoodLog, WeightLog } from '../../types/index'
import { calculateStreakState, longestStreak } from '../../lib/streak'
import { istDateStr } from '../../lib/dateUtils'
import { calculateMaintenance } from '../../lib/tdee'
import {
  groupKcalByIstDay,
  buildPeriodWindow,
  calculatePeriodDeficit,
  cumulativeSeries,
  type PeriodKind,
} from '../../lib/deficit-calculator'
import { BottomNav } from '../../components/layout/BottomNav'
import { ProgressClient } from '../../components/progress/ProgressClient'
import type { DeficitPeriodView } from '../../components/progress/DeficitTrendCard'

const WEEKDAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/**
 * Assemble one period the deficit card can render.
 *
 * This card asks "how have the last 7/30 days gone", not "how has this calendar
 * week/month gone" — so it deliberately opts into `buildPeriodWindow`'s `rolling`
 * mode rather than the app's default calendar window (see the note atop
 * `lib/deficit-calculator.ts`). `/deficit`'s week-by-week history is a different
 * question and stays calendar-only.
 *
 * When the trailing window has nothing finished in it — a brand-new account, or
 * a long gap with zero logs — fall back to the window just before it rather than
 * showing a dead card.
 */
function buildDeficitView(
  byDate: Map<string, number>,
  todayStr: string,
  kind: PeriodKind,
  tdee: number,
  paceKgPerWeek: number,
  goal: 'lose' | 'maintain' | 'gain'
): DeficitPeriodView {
  let win = buildPeriodWindow(byDate, todayStr, kind, 0, true)
  let isFallback = false
  if (win.completed.length === 0) {
    const previous = buildPeriodWindow(byDate, todayStr, kind, 1, true)
    if (previous.completed.length > 0) {
      win = previous
      isFallback = true
    }
  }

  const summary = calculatePeriodDeficit(win.completed, tdee, paceKgPerWeek, {
    periodDays: win.periodDays,
    daysElapsed: win.daysElapsed,
    goal,
    periodStart: win.periodStart,
  })

  // The dashed pace line advances one day's target per *logged* day, so its
  // endpoint is exactly `prorated_target_deficit` — the same yardstick the
  // percentage uses. Above the line means ahead, with no second definition.
  const targetPerDay = summary.target_deficit / win.periodDays
  const points = cumulativeSeries(win.completed, tdee).map((p, i) => ({
    label: kind === 'month'
      ? String(Number(p.date.slice(8)))
      : WEEKDAY_INITIAL[new Date(p.date + 'T00:00:00Z').getUTCDay()],
    cumulative: p.cumulative,
    target: Math.round(targetPerDay * (i + 1)),
  }))

  // "Last 7/30 days", not a calendar-period name — the window is rolling and can
  // span two months, so labelling it by month name would misdescribe it.
  const windowLabel = kind === 'month' ? 'Last 30 days' : 'Last 7 days'

  return {
    kind,
    label: isFallback ? `Previous ${kind === 'month' ? '30' : '7'} days` : windowLabel,
    summary,
    points,
    todayKcal: win.todayKcal,
    isFallback,
  }
}

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
    // No .limit() here — Pro is sold uncapped weight history. Free users are
    // trimmed to their cohort's weightRows in memory once Pro status is known
    // (below), the same one-network-stage pattern as the 90-day log fetch.
    supabase
      .from('weight_logs')
      .select('id, weight_kg, measured_at, notes')
      .eq('user_id', user.id)
      .order('measured_at', { ascending: false }),
    supabase
      .from('food_logs')
      .select('logged_at, kcal, protein_g, carbs_g, fat_g, meal, context')
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

  // Free-tier limits, keyed on signup cohort (lib/freeTier.ts). C1 ships these
  // identical to the previous hard-coded 7 / 30.
  const freeLimits = limitsForSignupDate(profile.created_at)

  // Trim the 90-day fetch down to the free-tier window before anything is
  // passed to the client — free users receive exactly the same days as before.
  const freeCutoff = new Date()
  freeCutoff.setUTCDate(freeCutoff.getUTCDate() - freeLimits.historyDays)
  const freeCutoffMs = freeCutoff.getTime()
  const withinTier = <T extends { logged_at: string }>(rows: T[]) =>
    isPro ? rows : rows.filter((r) => new Date(r.logged_at).getTime() >= freeCutoffMs)

  const streak      = calculateStreakState((streakResult.data ?? []) as unknown as FoodLog[]).streak
  // Weigh-ins are fetched uncapped now (Pro gets full history); free users keep
  // the previous window of the most-recent N rows.
  const allWeightLogs = (weightResult.data ?? []) as unknown as WeightLog[]
  const weightLogs  = isPro ? allWeightLogs : allWeightLogs.slice(0, freeLimits.weightRows)
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

  // ── Deficit periods ─────────────────────────────────────────────────────────
  // Derived here rather than in the client so `/progress` and `/deficit` cannot
  // drift: both read `calculatePeriodDeficit`, which is the only definition of
  // the word in the app. This reads the untrimmed rows — trimming to the free
  // 7-day window could clip Monday on a Sunday and silently shorten the week.
  const maintenance = calculateMaintenance({
    weightKg: profile.current_weight_kg,
    heightCm: profile.height_cm,
    age: profile.age,
    sex: profile.sex,
    activity_level: profile.activity_level,
  })
  const byDate = groupKcalByIstDay(allRecentLogs)
  const todayStr = istDateStr()
  const pace = profile.pace_kg_per_week ?? 0.5

  const weekView = buildDeficitView(byDate, todayStr, 'week', maintenance.tdee, pace, profile.goal)
  // The month is Pro. Withholding it here rather than hiding it in the client is
  // the difference between a gate and a CSS overlay over real numbers.
  const monthView = isPro
    ? buildDeficitView(byDate, todayStr, 'month', maintenance.tdee, pace, profile.goal)
    : null

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
          freeHistoryDays={freeLimits.historyDays}
          badgeStats={badgeStats}
          weekView={weekView}
          monthView={monthView}
          maintenanceKcal={maintenance.tdee}
        />
      </main>
      <BottomNav />
    </div>
  )
}
