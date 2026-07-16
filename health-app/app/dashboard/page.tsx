import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient, getAuthedUser } from '../../lib/supabase/server'
import type { FoodLog } from '../../types/index'
import { BottomNav } from '../../components/layout/BottomNav'
import { DashboardClient } from '../../components/dashboard/DashboardClient'
import { getUtcDayRange } from '../../lib/dateUtils'
import { calculateStreak } from '../../lib/streak'

export const metadata: Metadata = {
  title: 'Home — GetInShape',
  description: 'Your daily calorie snapshot.',
  robots: { index: false },
}

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createServerClient()
  const user = await getAuthedUser(supabase)

  const { start, end } = getUtcDayRange()

  // Streak looks back 60 days of log timestamps
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  // All three queries only need user.id — run them in one parallel round trip
  // instead of three sequential ones (each is a full network hop to Supabase).
  const [profileResult, logsResult, streakResult] = await Promise.all([
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
  ])

  const { data: profile, error: profileError } = profileResult
  if (profileError) throw new Error(profileError.message)
  if (!profile || profile.height_cm === null) redirect('/onboarding')

  const { data: rawLogs, error: logsError } = logsResult
  if (logsError) throw new Error(logsError.message)

  const { data: recentLogs } = streakResult

  const streakDays = calculateStreak((recentLogs ?? []) as unknown as FoodLog[])

  // UTC date keys with at least one log — feeds the week strip's dots
  // (same day semantics as /log's ?date= param).
  const loggedDates = Array.from(
    new Set((recentLogs ?? []).map((r) => String(r.logged_at).slice(0, 10)))
  )

  const foodLogs = (rawLogs ?? []) as unknown as FoodLog[]

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
          loggedDates={loggedDates}
        />
      </main>
      <BottomNav />
    </div>
  )
}
