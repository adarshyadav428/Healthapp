import { redirect } from 'next/navigation'
import { FoodSearch } from '../../components/log/FoodSearch'
import { TodayProgressBar } from '../../components/log/TodayProgressBar'
import { TodayFoodLog } from '../../components/log/TodayFoodLog'
import { Navbar } from '../../components/layout/Navbar'
import { BottomNav } from '../../components/layout/BottomNav'
import { createServerClient } from '../../lib/supabase/server'
import type { Food, FoodLog } from '../../types/index'
import { getUtcDayRange } from '../../lib/dateUtils'
import Link from 'next/link'
import { ChefHat } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false } }

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
    .select('height_cm, daily_calorie_target, protein_g_target, carbs_g_target, fat_g_target')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) throw new Error(profileError.message)
  if (!profile || profile.height_cm === null) redirect('/onboarding')

  const { start, end } = getUtcDayRange()

  // Check if user has yesterday's logs (for "copy yesterday" feature)
  const yesterday = new Date()
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const { start: yStart, end: yEnd } = getUtcDayRange(yesterday)

  const [logSnapshotResult, yesterdayResult, todayResult, todayLogsResult] = await Promise.all([
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
      .lt('logged_at', yEnd),
    supabase
      .from('food_logs')
      .select('kcal, protein_g, carbs_g, fat_g')
      .eq('user_id', user.id)
      .gte('logged_at', start)
      .lt('logged_at', end),
    supabase
      .from('food_logs')
      .select(`id, meal, grams, servings, kcal, protein_g, carbs_g, fat_g, logged_at, food:foods(${FOOD_SELECT})`)
      .eq('user_id', user.id)
      .gte('logged_at', start)
      .lt('logged_at', end)
      .order('logged_at', { ascending: true }),
  ])

  if (logSnapshotResult.error) throw new Error(logSnapshotResult.error.message)
  if (yesterdayResult.error) throw new Error(yesterdayResult.error.message)
  if (todayResult.error) throw new Error(todayResult.error.message)
  // todayLogsResult failure is soft — show empty list, don't crash
  const todayFoodLogs = (todayLogsResult.data ?? []) as unknown as FoodLog[]

  const logSnapshot = logSnapshotResult.data ?? []
  const yesterdayCount = yesterdayResult.count ?? 0
  const todayLogs = todayResult.data ?? []

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

  const totals = todayLogs.reduce(
    (acc, log) => {
      acc.kcal += log.kcal
      acc.protein_g += log.protein_g
      acc.carbs_g += log.carbs_g
      acc.fat_g += log.fat_g
      return acc
    },
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  )

  return (
    <div className="min-h-screen bg-background pb-32 dark:bg-slate-950">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_rgba(234,88,12,0.10),_transparent_50%)] dark:opacity-40" />
      <Navbar />
      <main className="mx-auto w-full max-w-md px-4 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-foreground">Log Food</h1>
            <p className="text-sm text-muted mt-0.5">Search 600+ Indian &amp; global foods</p>
          </div>
          <Link
            href="/recipes"
            className="flex items-center gap-1.5 rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700 hover:bg-orange-100 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-slate-800"
          >
            <ChefHat className="h-3.5 w-3.5" />
            Recipe builder
          </Link>
        </div>
        <div className="mt-4">
          <TodayProgressBar
            kcalEaten={Math.round(totals.kcal)}
            kcalTarget={profile.daily_calorie_target ?? 0}
            proteinEaten={Math.round(totals.protein_g)}
            proteinTarget={profile.protein_g_target ?? 0}
            carbsEaten={Math.round(totals.carbs_g)}
            carbsTarget={profile.carbs_g_target ?? 0}
            fatEaten={Math.round(totals.fat_g)}
            fatTarget={profile.fat_g_target ?? 0}
          />
        </div>
        <div className="mt-4">
          <FoodSearch
            recentFoods={recentFoods}
            frequentFoods={frequentFoods}
            hasYesterdayLogs={hasYesterdayLogs}
          />
        </div>

        <div className="mt-6">
          <TodayFoodLog initialLogs={todayFoodLogs} />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
