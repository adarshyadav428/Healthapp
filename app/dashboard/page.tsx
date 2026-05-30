import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createServerClient } from '../../lib/supabase/server'
import type { FoodLog } from '../../types/index'
import { Navbar } from '../../components/layout/Navbar'
import { BottomNav } from '../../components/layout/BottomNav'
import { DashboardClient } from '../../components/dashboard/DashboardClient'
import { getUtcDayRange } from '../../lib/dateUtils'

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

  // Only fetch today's food logs — weight/streak/history live on /progress
  const { data: rawLogs, error: logsError } = await supabase
    .from('food_logs')
    .select('id, food_id, meal, kcal, protein_g, carbs_g, fat_g, logged_at, food:foods(id,name)')
    .eq('user_id', user.id)
    .gte('logged_at', start)
    .lt('logged_at', end)
    .order('logged_at', { ascending: false })

  if (logsError) throw new Error(logsError.message)

  const foodLogs = (rawLogs ?? []) as unknown as FoodLog[]

  return (
    <div className="min-h-screen bg-background pb-48 dark:bg-slate-950">
      <Navbar />
      <main className="relative mx-auto w-full max-w-md px-4 pt-2 pb-4">
        <DashboardClient profile={profile} initialLogs={foodLogs} />
      </main>
      <BottomNav />
    </div>
  )
}
