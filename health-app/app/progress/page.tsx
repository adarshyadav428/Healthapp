import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient, getAuthedUser } from '../../lib/supabase/server'
import type { FoodLog, WeightLog } from '../../types/index'
import { calculateStreak } from '../../lib/streak'
import { getIstDayRange } from '../../lib/dateUtils'
import { BottomNav } from '../../components/layout/BottomNav'
import { ProgressClient } from '../../components/progress/ProgressClient'

export const metadata: Metadata = {
  title: 'Progress — GetInShape',
  description: 'Your weight trend, streaks and weekly overview.',
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

  // Date windows (IST-aware — "today"/"7 days" match what the user sees on their clock)
  const now = new Date()
  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setUTCDate(now.getUTCDate() - 60)
  const { start: sevenDaysAgoIst } = getIstDayRange(new Date(now.getTime() - 6 * 86_400_000))
  const { end: todayIstEnd } = getIstDayRange(now)

  const [streakResult, weightResult, weekResult] = await Promise.all([
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
      .select('kcal, logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', sevenDaysAgoIst)
      .lt('logged_at', todayIstEnd),
  ])

  const streak      = calculateStreak((streakResult.data ?? []) as unknown as FoodLog[])
  const weightLogs  = (weightResult.data ?? []) as unknown as WeightLog[]
  const weekLogs    = (!weekResult.error ? (weekResult.data ?? []) : []) as { kcal: number; logged_at: string }[]
  const loggedDates = (streakResult.data ?? []).map((r) => r.logged_at as string)

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
          weekLogs={weekLogs}
          kcalTarget={profile.daily_calorie_target}
          profile={profile}
          loggedDates={loggedDates}
        />
      </main>
      <BottomNav />
    </div>
  )
}
