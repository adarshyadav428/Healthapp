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

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) throw new Error(profileError.message)
  if (!profile || profile.height_cm === null) redirect('/onboarding')

  const { start, end } = getUtcDayRange()

  // Today's food logs
  const { data: rawLogs, error: logsError } = await supabase
    .from('food_logs')
    .select('id, food_id, meal, grams, servings, kcal, protein_g, carbs_g, fat_g, logged_at, food:foods(id,name,kcal_per_100g,protein_g_per_100g,carbs_g_per_100g,fat_g_per_100g,serving_size_g,serving_description)')
    .eq('user_id', user.id)
    .gte('logged_at', start)
    .lt('logged_at', end)
    .order('logged_at', { ascending: false })

  if (logsError) throw new Error(logsError.message)

  // Streak — fetch last 60 days of log timestamps
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentLogs } = await supabase
    .from('food_logs')
    .select('logged_at')
    .eq('user_id', user.id)
    .gte('logged_at', sixtyDaysAgo)

  const streakDays = calculateStreak((recentLogs ?? []) as unknown as FoodLog[])

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
        />
      </main>
      <BottomNav />
    </div>
  )
}
