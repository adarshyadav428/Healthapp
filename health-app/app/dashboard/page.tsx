import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient } from '../../lib/supabase/server'
import type { FoodLog } from '../../types/index'
import { HomeHeader } from '../../components/layout/HomeHeader'
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
  const { data: { session }, error: userError } = await supabase.auth.getSession()
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
    <div
      className="min-h-screen"
      style={{ background: '#FAFAF7' }}
    >
      <HomeHeader displayName={profile.display_name} />
      <main
        className="relative mx-auto w-full max-w-md px-[18px] pt-4"
        style={{ paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}
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
