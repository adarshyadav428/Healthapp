import { redirect } from 'next/navigation'
import { FoodSearch } from '../../components/log/FoodSearch'
import { Navbar } from '../../components/layout/Navbar'
import { BottomNav } from '../../components/layout/BottomNav'
import { createServerClient } from '../../lib/supabase/server'
import type { Food, FoodLog } from '../../types/index'
import { getUtcDayRange } from '../../lib/dateUtils'

export const dynamic = 'force-dynamic'

export default async function LogPage() {
  const supabase = createServerClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (error || !user) redirect('/auth/sign-in')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('height_cm')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) throw new Error(profileError.message)
  if (!profile || profile.height_cm === null) redirect('/onboarding')

  // Fetch recent unique foods — last 20 logs, unique by food_id
  const { data: recentLogs } = await supabase
    .from('food_logs')
    .select('food_id, food:foods(*)')
    .eq('user_id', user.id)
    .order('logged_at', { ascending: false })
    .limit(40)

  // Deduplicate by food_id, keep first occurrence (most recent)
  const seenIds = new Set<string>()
  const recentFoods: Food[] = []
  for (const log of recentLogs ?? []) {
    if (log.food && !seenIds.has(log.food_id)) {
      seenIds.add(log.food_id)
      recentFoods.push(log.food as unknown as Food)
      if (recentFoods.length >= 8) break
    }
  }

  // Check if user has yesterday's logs (for "copy yesterday" feature)
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const { start: yStart, end: yEnd } = getUtcDayRange(yesterday)

  const { data: yesterdayLogs } = await supabase
    .from('food_logs')
    .select('*, food:foods(*)')
    .eq('user_id', user.id)
    .gte('logged_at', yStart)
    .lt('logged_at', yEnd)
    .order('logged_at', { ascending: true })

  const hasYesterdayLogs = (yesterdayLogs ?? []).length > 0

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <Navbar />
      <main className="mx-auto w-full max-w-md px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900">Log Food</h1>
        <p className="text-sm text-gray-500 mt-0.5">Search from 300+ Indian &amp; global foods</p>
        <div className="mt-4">
          <FoodSearch
            recentFoods={recentFoods}
            hasYesterdayLogs={hasYesterdayLogs}
            yesterdayLogs={(yesterdayLogs ?? []) as FoodLog[]}
          />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
