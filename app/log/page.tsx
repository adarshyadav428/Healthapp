import { redirect } from 'next/navigation'
import { FoodSearch } from '../../components/log/FoodSearch'
import { Navbar } from '../../components/layout/Navbar'
import { BottomNav } from '../../components/layout/BottomNav'
import { createServerClient } from '../../lib/supabase/server'
import type { Food } from '../../types/index'
import { getUtcDayRange } from '../../lib/dateUtils'

export const dynamic = 'force-dynamic'

const FOOD_SELECT =
  'id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g'

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

  // Check if user has yesterday's logs (for "copy yesterday" feature)
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const { start: yStart, end: yEnd } = getUtcDayRange(yesterday)

  const [logSnapshotResult, yesterdayResult] = await Promise.all([
    supabase
      .from('food_logs')
      .select(`food_id, food:foods(${FOOD_SELECT})`)
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(200),
    supabase
      .from('food_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('logged_at', yStart)
      .lt('logged_at', yEnd)
  ])

  if (logSnapshotResult.error) throw new Error(logSnapshotResult.error.message)
  if (yesterdayResult.error) throw new Error(yesterdayResult.error.message)

  const logSnapshot = logSnapshotResult.data ?? []
  const yesterdayCount = yesterdayResult.count ?? 0

  // Deduplicate by food_id for recent foods and count frequency in one pass
  const seenIds = new Set<string>()
  const recentFoods: Food[] = []
  const frequentMap = new Map<string, { food: Food; count: number; lastIndex: number }>()
  let index = 0
  for (const log of logSnapshot) {
    if (log.food && !seenIds.has(log.food_id) && recentFoods.length < 5) {
      seenIds.add(log.food_id)
      recentFoods.push(log.food as unknown as Food)
    }

    if (log.food) {
      const existing = frequentMap.get(log.food_id)
      if (existing) {
        existing.count += 1
      } else {
        frequentMap.set(log.food_id, { food: log.food as unknown as Food, count: 1, lastIndex: index })
      }
    }

    index += 1
  }

  const frequentFoods = Array.from(frequentMap.values())
    .sort((a, b) => (b.count - a.count) || (a.lastIndex - b.lastIndex))
    .slice(0, 8)
    .map((entry) => entry.food)

  const hasYesterdayLogs = yesterdayCount > 0

  return (
    <div className="min-h-screen bg-[#fff7ed] pb-24">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_rgba(234,88,12,0.10),_transparent_50%)]" />
      <Navbar />
      <main className="mx-auto w-full max-w-md px-4 py-6">
        <h1 className="text-2xl font-black text-gray-900">Log Food</h1>
        <p className="text-sm text-gray-500 mt-0.5">Search 600+ Indian &amp; global foods</p>
        <div className="mt-4">
          <FoodSearch
            recentFoods={recentFoods}
            frequentFoods={frequentFoods}
            hasYesterdayLogs={hasYesterdayLogs}
          />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
