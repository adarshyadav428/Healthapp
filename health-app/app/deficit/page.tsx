import { redirect } from 'next/navigation'
import { createServerClient } from '../../lib/supabase/server'
import { Navbar } from '../../components/layout/Navbar'
import { BottomNav } from '../../components/layout/BottomNav'
import { DeficitPageClient } from '../../components/progress/DeficitPageClient'
import { calculateBMR, activityMultiplier } from '../../lib/tdee'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Deficit Tracker — GetInShape', robots: { index: false } }

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

function toIstDateKey(iso: string) {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

export default async function DeficitPage() {
  const supabase = createServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/sign-in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle()

  if (!profile || !profile.height_cm) redirect('/onboarding')

  // Maintenance TDEE (what the body burns — same formula as everywhere)
  const bmr = calculateBMR({
    weightKg: profile.current_weight_kg,
    heightCm: profile.height_cm,
    age:      profile.age,
    sex:      profile.sex,
  })
  const tdee = Math.round(bmr * activityMultiplier(profile.activity_level))

  // Single source of truth: the stored daily_calorie_target (same as dashboard ring)
  const eatTarget          = profile.daily_calorie_target
  const actualDailyDeficit = Math.max(0, tdee - eatTarget)
  const actualWeeklyTarget = actualDailyDeficit * 7
  const impliedPaceKg      = actualWeeklyTarget > 0
    ? Math.round(actualWeeklyTarget / 7700 * 100) / 100
    : 0

  // Fetch last 28 days of logs
  const since = new Date(Date.now() - 28 * 86_400_000).toISOString()
  const { data: logs } = await supabase
    .from('food_logs')
    .select('kcal, logged_at')
    .eq('user_id', session.user.id)
    .gte('logged_at', since)
    .order('logged_at', { ascending: true })

  // Group by IST date
  const byDate = new Map<string, number>()
  for (const log of logs ?? []) {
    const date = toIstDateKey(log.logged_at)
    byDate.set(date, (byDate.get(date) ?? 0) + log.kcal)
  }
  const days = Array.from(byDate.entries())
    .map(([date, calories]) => ({ date, calories: Math.round(calories) }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const todayKey = toIstDateKey(new Date().toISOString())

  // All-time fat burned
  const { data: allLogs } = await supabase
    .from('food_logs')
    .select('kcal, logged_at')
    .eq('user_id', session.user.id)

  const allByDate = new Map<string, number>()
  for (const log of allLogs ?? []) {
    const date = toIstDateKey(log.logged_at)
    allByDate.set(date, (allByDate.get(date) ?? 0) + log.kcal)
  }
  const allDayCount  = allByDate.size
  const totalDeficit = Array.from(allByDate.values()).reduce((sum, cal) => sum + (tdee - cal), 0)
  const totalFatKg   = Math.max(0, totalDeficit / 7700)

  return (
    <div className="min-h-screen bg-background pb-32 dark:bg-slate-950">
      <Navbar />
      <main className="mx-auto w-full max-w-md px-4 pt-4 pb-6">
        <div className="mb-4">
          <h1 className="text-[28px] font-black text-foreground leading-tight">Deficit Tracker</h1>
          <p className="text-sm text-muted">1 kg fat = 7,700 kcal deficit</p>
        </div>

        <DeficitPageClient
          days={days}
          tdee={tdee}
          eatTarget={eatTarget}
          actualDailyDeficit={actualDailyDeficit}
          actualWeeklyTarget={actualWeeklyTarget}
          impliedPaceKg={impliedPaceKg}
          today={todayKey}
          totalFatKg={Math.round(totalFatKg * 100) / 100}
          totalDaysLogged={allDayCount}
          targetWeightKg={profile.target_weight_kg ?? null}
        />
      </main>
      <BottomNav />
    </div>
  )
}
