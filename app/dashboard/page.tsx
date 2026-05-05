import { redirect } from 'next/navigation'
import { createServerClient } from '../../lib/supabase/server'
import type { FoodLog, WeightLog, ExerciseLog } from '../../types/index'
import { calculateStreak } from '../../lib/streak'
import { Navbar } from '../../components/layout/Navbar'
import { BottomNav } from '../../components/layout/BottomNav'
import { DashboardClient } from '../../components/dashboard/DashboardClient'
import Link from 'next/link'
import { Button } from '../../components/ui/button'
import { getUtcDayRange } from '../../lib/dateUtils'

export const dynamic = 'force-dynamic'

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

  const [logsResult, exerciseResult, weightResult, streakResult] = await Promise.all([
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
  ])

  if (logsResult.error) throw new Error(logsResult.error.message)
  // exercise_logs table may not exist yet — degrade gracefully instead of crashing
  if (weightResult.error) throw new Error(weightResult.error.message)
  if (streakResult.error) throw new Error(streakResult.error.message)

  const foodLogs = (logsResult.data ?? []) as unknown as FoodLog[]
  const exerciseLogs = (!exerciseResult.error ? (exerciseResult.data ?? []) : []) as unknown as ExerciseLog[]
  const weightLogs = (weightResult.data ?? []) as unknown as WeightLog[]
  const streak = calculateStreak((streakResult.data ?? []) as unknown as FoodLog[])

  return (
    <div className="min-h-screen bg-[#fff7ed] pb-24">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.25),_transparent_50%),radial-gradient(circle_at_20%_60%,_rgba(248,113,113,0.2),_transparent_55%),radial-gradient(circle_at_80%_20%,_rgba(16,185,129,0.18),_transparent_45%)]" />
      <Navbar />
      <main className="relative mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Today</h1>
            <p className="text-sm text-gray-600">Your daily snapshot</p>
          </div>
          <div className="text-xs font-semibold text-orange-600 bg-white/80 border border-orange-100 px-2 py-1 rounded-full">
            CalTrack
          </div>
        </div>

        <DashboardClient
          profile={profile}
          initialLogs={foodLogs}
          streak={streak}
          weightLogs={weightLogs}
          initialExerciseLogs={exerciseLogs}
        />

        <Button asChild className="w-full bg-orange-600 hover:bg-orange-700">
          <Link href="/log">Add Food</Link>
        </Button>
      </main>
      <BottomNav />
    </div>
  )
}
