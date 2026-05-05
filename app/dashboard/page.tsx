import { redirect } from 'next/navigation'
import { createServerClient } from '../../lib/supabase/server'
import type { FoodLog } from '../../types/index'
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

  const { data: logs, error: logsError } = await supabase
    .from('food_logs')
    .select('*, food:foods(*)')
    .eq('user_id', user.id)
    .gte('logged_at', start)
    .lt('logged_at', end)
    .order('logged_at', { ascending: false })

  if (logsError) throw new Error(logsError.message)

  const foodLogs = (logs ?? []) as FoodLog[]

  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setUTCDate(sixtyDaysAgo.getUTCDate() - 60)

  const { data: streakLogs, error: streakError } = await supabase
    .from('food_logs')
    .select('logged_at')
    .eq('user_id', user.id)
    .gte('logged_at', sixtyDaysAgo.toISOString())

  if (streakError) throw new Error(streakError.message)

  const streak = calculateStreak((streakLogs ?? []) as FoodLog[])

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navbar />
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-6">
        <DashboardClient profile={profile} initialLogs={foodLogs} streak={streak} />

        <Button asChild className="w-full">
          <Link href="/log">Add Food</Link>
        </Button>
      </main>
      <BottomNav />
    </div>
  )
}
