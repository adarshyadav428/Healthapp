import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient, getAuthedUser } from '../../lib/supabase/server'
import type { FoodLog, WeightLog } from '../../types/index'
import { calculateStreak } from '../../lib/streak'
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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) throw new Error(profileError.message)
  if (!profile || profile.height_cm === null) redirect('/onboarding')

  // Pro status — free users only see the last 7 days of trend history
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle()
  const isPro = Boolean(sub && (sub.status === 'active' || sub.status === 'trialing'))

  // Streak always looks back 60 days regardless of Pro status — it's a free,
  // always-on stat, independent of the Pro-gated trend-history depth below.
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60)

  // Free → 7 days, Pro → 90 days of trend/macro history
  const lookbackDays = isPro ? 90 : 7
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - lookbackDays)

  const [streakResult, weightResult, logsResult, exerciseResult] = await Promise.all([
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
  ])

  if (logsResult.error) throw new Error(logsResult.error.message)

  const streak      = calculateStreak((streakResult.data ?? []) as unknown as FoodLog[])
  const weightLogs  = (weightResult.data ?? []) as unknown as WeightLog[]
  const loggedDates = (streakResult.data ?? []).map((r) => r.logged_at as string)
  const logs        = logsResult.data ?? []
  // Exercise logs are optional — table may not exist yet
  const exerciseLogs = exerciseResult.error ? [] : (exerciseResult.data ?? [])

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
        />
      </main>
      <BottomNav />
    </div>
  )
}
