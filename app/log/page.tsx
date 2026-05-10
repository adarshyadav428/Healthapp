import { redirect } from 'next/navigation'
import { FoodSearch } from '../../components/log/FoodSearch'
import { LogProgressClient } from '../../components/log/LogProgressClient'
import { TodayFoodLog } from '../../components/log/TodayFoodLog'
import { LogPageShell } from '../../components/log/LogPageShell'
import { WaterTracker } from '../../components/log/WaterTracker'
import { ExerciseLogger } from '../../components/log/ExerciseLogger'
import { DateNav } from '../../components/log/DateNav'
import { Navbar } from '../../components/layout/Navbar'
import { BottomNav } from '../../components/layout/BottomNav'
import { createServerClient } from '../../lib/supabase/server'
import type { Food, FoodLog } from '../../types/index'
import { getUtcDayRange } from '../../lib/dateUtils'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false } }

const FOOD_SELECT =
  'id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g'

/** Parse a YYYY-MM-DD string (UTC) into a Date. Returns today on invalid input. */
function parseDateParam(raw: string | undefined): { date: Date; dateStr: string } {
  const todayUtc = new Date()
  const todayStr = [
    todayUtc.getUTCFullYear(),
    String(todayUtc.getUTCMonth() + 1).padStart(2, '0'),
    String(todayUtc.getUTCDate()).padStart(2, '0'),
  ].join('-')

  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { date: todayUtc, dateStr: todayStr }
  }

  const [year, month, day] = raw.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))

  // Clamp: never let future dates be viewed
  if (raw > todayStr) return { date: todayUtc, dateStr: todayStr }

  return { date: d, dateStr: raw }
}

export default async function LogPage({
  searchParams,
}: {
  searchParams: { date?: string }
}) {
  const supabase = createServerClient()
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (error || !user) redirect('/auth/sign-in')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('height_cm, daily_calorie_target, protein_g_target, carbs_g_target, fat_g_target, current_weight_kg, water_target_ml')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) throw new Error(profileError.message)
  if (!profile || profile.height_cm === null) redirect('/onboarding')

  const { date: viewDate, dateStr } = parseDateParam(searchParams?.date)

  // Today's UTC string for comparison
  const nowUtc = new Date()
  const todayStr = [
    nowUtc.getUTCFullYear(),
    String(nowUtc.getUTCMonth() + 1).padStart(2, '0'),
    String(nowUtc.getUTCDate()).padStart(2, '0'),
  ].join('-')
  const isToday = dateStr === todayStr

  const { start, end } = getUtcDayRange(viewDate)

  // Check if user has yesterday's logs (for "copy yesterday" feature — only relevant on today's view)
  const yesterday = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), nowUtc.getUTCDate() - 1))
  const { start: yStart, end: yEnd } = getUtcDayRange(yesterday)

  const [logSnapshotResult, yesterdayResult, dayResult, dayLogsResult] = await Promise.all([
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
  if (dayResult.error) throw new Error(dayResult.error.message)

  const dayFoodLogs = (dayLogsResult.data ?? []) as unknown as FoodLog[]
  const logSnapshot = logSnapshotResult.data ?? []
  const yesterdayCount = yesterdayResult.count ?? 0
  const dayLogs = dayResult.data ?? []

  // Build recent + frequent foods from all-time history
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

  const totals = dayLogs.reduce(
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
      <Navbar />
      <main className="mx-auto w-full max-w-md px-4 pt-4 pb-6">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-[28px] font-black text-foreground leading-tight">Food Diary</h1>
          <p className="text-sm text-muted">{isToday ? 'What did you eat today?' : 'Viewing past entry'}</p>
        </div>

        {/* Date navigation */}
        <DateNav dateStr={dateStr} />

        {/* Calorie progress bar — live for today, static for past */}
        <LogProgressClient
          initialLogs={dayFoodLogs}
          kcalTarget={profile.daily_calorie_target ?? 0}
          proteinTarget={profile.protein_g_target ?? 0}
          carbsTarget={profile.carbs_g_target ?? 0}
          fatTarget={profile.fat_g_target ?? 0}
        />

        {/* Logging controls — only shown for today */}
        {isToday && (
          <>
            {/* Quick Add button */}
            <LogPageShell />

            {/* Food search */}
            <div className="mt-4">
              <FoodSearch
                recentFoods={recentFoods}
                frequentFoods={frequentFoods}
                hasYesterdayLogs={hasYesterdayLogs}
              />
            </div>
          </>
        )}

        {/* Food log for the selected day */}
        <div className="mt-6">
          <TodayFoodLog initialLogs={dayFoodLogs} />
        </div>

        {/* Water & exercise — always today-specific */}
        {isToday && (
          <>
            <div className="mt-4">
              <WaterTracker waterTargetMl={profile.water_target_ml ?? 2500} />
            </div>
            <div className="mt-4">
              <ExerciseLogger weightKg={profile.current_weight_kg ?? 70} />
            </div>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
