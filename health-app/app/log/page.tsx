import { redirect } from 'next/navigation'
import nextDynamic from 'next/dynamic'
import { FoodLanding } from '../../components/log/FoodLanding'
import { LogProgressClient } from '../../components/log/LogProgressClient'
import { TodayFoodLog } from '../../components/log/TodayFoodLog'
import { FoodHeader } from '../../components/log/FoodHeader'
import { SwipeDayNav } from '../../components/log/SwipeDayNav'
import { BottomNav } from '../../components/layout/BottomNav'
import { createServerClient, getAuthedUser } from '../../lib/supabase/server'
import { isProStatus } from '../../lib/subscription'
import type { Food, FoodLog } from '../../types/index'
import { getIstDayRange, istDateStr, dateStrToUtcMidnight } from '../../lib/dateUtils'
import { isWithinFreeLogWindow } from '../../lib/backfill'
import { shiftDateStr } from '../../lib/logDates'

// Below-fold widgets — split into separate chunks so they don't block initial JS parse.
const SkeletonCard = () => <div className="h-32 rounded-2xl bg-card border border-border animate-pulse" />
const ExerciseLogger = nextDynamic(() => import('../../components/log/ExerciseLogger').then(m => m.ExerciseLogger), { ssr: false, loading: SkeletonCard })

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false } }

const FOOD_SELECT =
  'id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, common_portions'

/**
 * Parse a YYYY-MM-DD string as an IST calendar day. Returns today (IST) on
 * missing/invalid/future input. `date` is what we hand to getIstDayRange:
 * for today we pass `now` (its IST day is today); for a past day we pass that
 * date's UTC midnight (getIstDayRange resolves it to the right IST day).
 */
function parseDateParam(raw: string | undefined): { date: Date; dateStr: string } {
  const todayStr = istDateStr()

  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || raw >= todayStr) {
    // Missing, malformed, today, or a future date → clamp to today (IST).
    return { date: new Date(), dateStr: todayStr }
  }

  return { date: dateStrToUtcMidnight(raw), dateStr: raw }
}

export default async function LogPage({
  searchParams,
}: {
  searchParams: { date?: string }
}) {
  const supabase = createServerClient()
  const user = await getAuthedUser(supabase)

  const { date: viewDate, dateStr } = parseDateParam(searchParams?.date)

  // "Today" is the IST calendar date (not UTC — a 1am-IST log is still today).
  const todayStr = istDateStr()
  const isToday = dateStr === todayStr

  const { start, end } = getIstDayRange(viewDate)

  // Check if user has yesterday's (IST) logs — for the "copy yesterday" feature.
  const { start: yStart, end: yEnd } = getIstDayRange(new Date(Date.now() - 24 * 60 * 60 * 1000))

  // Every query below only needs user.id — one parallel round trip instead of
  // three sequential stages (profile → subscription → data). The profile /
  // onboarding and Pro-history checks run on the results afterwards.
  const [profileResult, subResult, logSnapshotResult, yesterdayResult, dayLogsResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('height_cm, daily_calorie_target, protein_g_target, carbs_g_target, fat_g_target, current_weight_kg, water_target_ml, display_name')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('subscriptions').select('status').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('food_logs')
      .select(`food_id, grams, kcal, meal, food:foods(${FOOD_SELECT})`)
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(200),
    supabase
      .from('food_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('logged_at', yStart)
      .lt('logged_at', yEnd),
    // One read of the viewed day, not two. There used to be a second query
    // selecting just the macro columns for the same range, feeding a `totals`
    // reduce that nothing rendered — LogProgressClient recomputes totals from
    // initialLogs itself.
    supabase
      .from('food_logs')
      .select(`id, meal, grams, servings, kcal, protein_g, carbs_g, fat_g, logged_at, food:foods(${FOOD_SELECT})`)
      .eq('user_id', user.id)
      .gte('logged_at', start)
      .lt('logged_at', end)
      .order('logged_at', { ascending: true }),
  ])

  const { data: profile, error: profileError } = profileResult
  if (profileError) throw new Error(profileError.message)
  if (!profile || profile.height_cm === null) redirect('/onboarding')

  // Check Pro status — free users can only view the last 7 days of history
  const sub = subResult.data
  const isPro = isProStatus(sub?.status)

  // A day is editable (backfill-able) if it's within the free 7-day window, or
  // for any past day when Pro. Drives whether the logging surface renders.
  const isEditable = isPro || isWithinFreeLogWindow(dateStr)

  // Would stepping one day earlier leave the free history window? Drives the
  // header's back-chevron: a free user at the boundary sees a lock, not a
  // control that silently teleports them to the paywall.
  const prevDayLocked = !isPro && !isWithinFreeLogWindow(shiftDateStr(dateStr, -1))

  // Free-tier history gate: clamp dates older than 7 IST days
  if (!isPro && searchParams?.date) {
    const cutoffStr = istDateStr(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    if (dateStr < cutoffStr) redirect('/upgrade?reason=history')
  }

  if (logSnapshotResult.error) throw new Error(logSnapshotResult.error.message)
  if (yesterdayResult.error) throw new Error(yesterdayResult.error.message)
  if (dayLogsResult.error) throw new Error(dayLogsResult.error.message)

  const dayFoodLogs = (dayLogsResult.data ?? []) as unknown as FoodLog[]
  const logSnapshot = logSnapshotResult.data ?? []
  const yesterdayCount = yesterdayResult.count ?? 0

  // Build recent + frequent foods from all-time history
  type SnapshotRow = { food_id: string | null; grams: number; kcal: number; meal: string; food: Food | null }
  type RecentLogItem = { food: Food; grams: number; kcal: number; meal: string }
  const typedSnapshot = (logSnapshot as unknown as SnapshotRow[])
  const seenIds = new Set<string>()
  const recentFoods: Food[] = []
  const recentLogItems: RecentLogItem[] = []
  const frequentMap = new Map<string, { food: Food; count: number; lastIndex: number }>()
  let index = 0
  for (const log of typedSnapshot) {
    if (log.food && log.food_id && !seenIds.has(log.food_id) && recentFoods.length < 5) {
      seenIds.add(log.food_id)
      recentFoods.push(log.food)
      recentLogItems.push({ food: log.food, grams: log.grams ?? log.food.serving_size_g, kcal: log.kcal ?? 0, meal: log.meal ?? 'snack' })
    }
    if (log.food && log.food_id) {
      const existing = frequentMap.get(log.food_id)
      if (existing) {
        existing.count += 1
      } else {
        frequentMap.set(log.food_id, { food: log.food, count: 1, lastIndex: index })
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
    <div className="min-h-screen">
      <main
        className="mx-auto w-full max-w-md px-6"
        style={{
          paddingTop: 'calc(20px + env(safe-area-inset-top))',
          paddingBottom: 'calc(120px + env(safe-area-inset-bottom))',
        }}
      >
        {/* Header — date + Food title + Today pill + prev/next day chips */}
        <FoodHeader dateStr={dateStr} prevDayLocked={prevDayLocked} />

        {/* Swipe left/right anywhere below the header to change days */}
        <SwipeDayNav dateStr={dateStr} prevDayLocked={prevDayLocked}>

        {/* Calorie summary — live for today, static for past */}
        <div className="mt-4">
          <LogProgressClient
            initialLogs={dayFoodLogs}
            kcalTarget={profile.daily_calorie_target ?? 0}
            proteinTarget={profile.protein_g_target ?? 0}
            carbsTarget={profile.carbs_g_target ?? 0}
            fatTarget={profile.fat_g_target ?? 0}
            date={viewDate}
          />
        </div>

        {/* 1f landing: search pill + scan/quick-add + log again + copy yesterday.
            Renders on any editable day so a missed day can be backfilled (P1-2). */}
        {isEditable && (
          <div className="mt-4">
            <FoodLanding
              recentFoods={recentFoods}
              recentLogItems={recentLogItems}
              frequentFoods={frequentFoods}
              hasYesterdayLogs={hasYesterdayLogs}
              logDate={dateStr}
              isToday={isToday}
              isPro={isPro}
            />
          </div>
        )}

        {/* Editable day log for the selected day (kept below the landing) */}
        <div className="mt-6">
          <TodayFoodLog initialLogs={dayFoodLogs} date={viewDate} displayName={profile.display_name} />
        </div>

        {/* Exercise — always today-specific */}
        {isToday && (
          <div className="mt-4">
            <ExerciseLogger weightKg={profile.current_weight_kg ?? 70} />
          </div>
        )}
        </SwipeDayNav>
      </main>
      <BottomNav />
    </div>
  )
}
