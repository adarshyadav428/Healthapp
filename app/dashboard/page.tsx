import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient } from '../../lib/supabase/server'
import type { FoodLog, WeightLog, ExerciseLog } from '../../types/index'
import { calculateStreak } from '../../lib/streak'
import { Navbar } from '../../components/layout/Navbar'
import { BottomNav } from '../../components/layout/BottomNav'
import { DashboardClient } from '../../components/dashboard/DashboardClient'
import { getUtcDayRange } from '../../lib/dateUtils'

export const metadata: Metadata = {
  title: 'Dashboard — CalTrack',
  description: 'Your daily calorie, macro, and nutrition dashboard.',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

function getGreeting() {
  const istHour = (new Date().getUTCHours() + 5) % 24
  if (istHour < 12) return 'Good morning'
  if (istHour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function DashboardPage() {
  const supabase = createServerClient()
  const {
    data: { session },
    error: userError,
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (userError || !user) redirect('/auth/sign-in')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) throw new Error(profileError.message)
  if (!profile || profile.height_cm === null) redirect('/onboarding')

  const { start, end } = getUtcDayRange()

  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60)

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6)
  sevenDaysAgo.setUTCHours(0, 0, 0, 0)

  const [logsResult, exerciseResult, weightResult, streakResult, weekResult] = await Promise.all([
    supabase
      .from('food_logs')
      .select('id, food_id, meal, kcal, protein_g, carbs_g, fat_g, logged_at, food:foods(id,name)')
      .eq('user_id', user.id)
      .gte('logged_at', start)
      .lt('logged_at', end)
      .order('logged_at', { ascending: false }),
    supabase
      .from('exercise_logs')
      .select('id, activity, duration_min, calories, logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', start)
      .lt('logged_at', end)
      .order('logged_at', { ascending: false }),
    supabase
      .from('weight_logs')
      .select('id, weight_kg, measured_at')
      .eq('user_id', user.id)
      .order('measured_at', { ascending: false })
      .limit(14),
    supabase
      .from('food_logs')
      .select('logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', sixtyDaysAgo.toISOString()),
    supabase
      .from('food_logs')
      .select('kcal, logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', sevenDaysAgo.toISOString())
      .lt('logged_at', end),
  ])

  if (logsResult.error) throw new Error(logsResult.error.message)
  if (weightResult.error) throw new Error(weightResult.error.message)
  if (streakResult.error) throw new Error(streakResult.error.message)

  const foodLogs = (logsResult.data ?? []) as unknown as FoodLog[]
  const exerciseLogs = (!exerciseResult.error ? (exerciseResult.data ?? []) : []) as unknown as ExerciseLog[]
  const weightLogs = (weightResult.data ?? []) as unknown as WeightLog[]
  const streak = calculateStreak((streakResult.data ?? []) as unknown as FoodLog[])
  const weekLogs = (!weekResult.error ? (weekResult.data ?? []) : []) as { kcal: number; logged_at: string }[]

  const firstName = profile.display_name?.split(' ')[0] ?? null
  const greeting = getGreeting()

  return (
    <div className="min-h-screen bg-background pb-32 dark:bg-slate-950">
      {/* Subtle ambient gradient */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_rgba(249,115,22,0.07),_transparent_60%)] dark:opacity-40" />
      <Navbar />
      <main className="relative mx-auto w-full max-w-md px-4 py-5">
        {/* Page header */}
        <div className="mb-5">
          <p className="text-sm font-semibold text-orange-500 dark:text-orange-400">
            {greeting}{firstName ? `, ${firstName}` : ''} 👋
          </p>
          <h1 className="text-[28px] font-black text-foreground leading-tight">Today</h1>
        </div>

        <DashboardClient
          profile={profile}
          initialLogs={foodLogs}
          streak={streak}
          weightLogs={weightLogs}
          initialExerciseLogs={exerciseLogs}
          weekLogs={weekLogs}
        />
      </main>
      <BottomNav />
    </div>
  )
}
