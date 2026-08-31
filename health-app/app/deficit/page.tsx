import { redirect } from 'next/navigation'
import { createServerClient, getAuthedUser } from '../../lib/supabase/server'
import { PageHeader } from '../../components/layout/PageHeader'
import { BottomNav } from '../../components/layout/BottomNav'
import { DeficitPageClient, type WeekView } from '../../components/progress/DeficitPageClient'
import { ProLock } from '../../components/ui/ProLock'
import { calculateMaintenance } from '../../lib/tdee'
import { istDateStr } from '../../lib/dateUtils'
import { isProStatus } from '../../lib/subscription'
import { deficitAccess } from '../../lib/deficitAccess'
import {
  groupKcalByIstDay,
  buildWeekWindow,
  calculateWeeklyDeficit,
} from '../../lib/deficit-calculator'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Deficit Tracker — GetInShape', robots: { index: false } }

/** How many weeks of history the page shows, current week included. */
const WEEKS_SHOWN = 4

export default async function DeficitPage() {
  const supabase = createServerClient()
  const user = await getAuthedUser(supabase)

  // All four queries only need user.id — one parallel round trip, not four
  // sequential. `allLogs` is the heavy all-time scan; it's only used to build
  // the deficit view a locked user never sees, but skipping it would mean a
  // second sequential round trip for the common (allowed) path, so it rides
  // along here and its result is simply ignored when access is denied.
  const since = new Date(Date.now() - 28 * 86_400_000).toISOString()
  const [{ data: profile }, { data: logs }, { data: allLogs }, { data: sub }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase
      .from('food_logs')
      .select('kcal, logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', since)
      .order('logged_at', { ascending: true }),
    supabase.from('food_logs').select('kcal, logged_at').eq('user_id', user.id),
    supabase.from('subscriptions').select('status').eq('user_id', user.id).maybeSingle(),
  ])

  if (!profile || !profile.height_cm) redirect('/onboarding')

  // /deficit is Pro as of the pricing repositioning (C2). Grandfathered
  // (pre-cutoff) and Pro accounts render exactly as before; a post-cutoff free
  // account gets a 3-day taste, then this locked state.
  const access = deficitAccess({
    isPro: isProStatus(sub?.status),
    createdAt: profile.created_at,
  })
  if (!access.allowed) {
    return (
      <div className="min-h-screen">
        <main
          className="mx-auto w-full max-w-md px-6"
          style={{ paddingTop: 'calc(20px + env(safe-area-inset-top))', paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}
        >
          <PageHeader label="1 kg fat = 7,700 kcal deficit" title="Deficit" back />
          <div className="mt-5">
            <ProLock.Card
              reason="history"
              title="Your calorie deficit is a Pro feature"
              body="You had 3 days to see how it works. Pro keeps the full picture — every week's deficit, what it's worth in fat, and where you're heading."
            />
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  // One source of maintenance, shared with /progress and every other surface.
  const maintenance = calculateMaintenance({
    weightKg: profile.current_weight_kg,
    heightCm: profile.height_cm,
    age: profile.age,
    sex: profile.sex,
    activity_level: profile.activity_level,
  })

  const todayStr = istDateStr()
  const paceKg = profile.pace_kg_per_week ?? 0.5
  const byDate = groupKcalByIstDay(logs ?? [])

  // Current week first in the data, rendered oldest-first in the chart.
  const weeks: WeekView[] = Array.from({ length: WEEKS_SHOWN }, (_, i) => {
    const w = buildWeekWindow(byDate, todayStr, i)
    const summary = calculateWeeklyDeficit(w.completed, maintenance.tdee, paceKg, {
      daysElapsed: w.daysElapsed,
      goal: profile.goal,
      weekStart: w.weekStart,
    })
    return {
      weekStart: w.weekStart,
      label: new Date(w.weekStart + 'T00:00:00Z').toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }),
      summary,
      days: w.dates.map((date) => ({
        date,
        kcal: byDate.has(date) ? Math.round(byDate.get(date) ?? 0) : null,
        state:
          date > todayStr ? ('future' as const)
          : date === todayStr ? ('today' as const)
          : byDate.has(date) ? ('done' as const)
          : ('missed' as const),
      })),
    }
  }).reverse()

  // All-time: completed days only. Today is half-eaten, and counting it here is
  // what used to make "total fat burned" fall as the user logged lunch.
  const allByDate = groupKcalByIstDay(allLogs ?? [])
  let totalDeficit = 0
  let completedDays = 0
  for (const [date, kcal] of allByDate) {
    if (date >= todayStr) continue
    totalDeficit += maintenance.tdee - kcal
    completedDays++
  }

  return (
    <div className="min-h-screen">
      <main
        className="mx-auto w-full max-w-md px-6"
        style={{ paddingTop: 'calc(20px + env(safe-area-inset-top))', paddingBottom: 'calc(120px + env(safe-area-inset-bottom))' }}
      >
        <PageHeader label="1 kg fat = 7,700 kcal deficit" title="Deficit" back />
        <div className="mt-5">
          <DeficitPageClient
            weeks={weeks}
            maintenance={maintenance}
            activityLevel={profile.activity_level}
            eatTarget={profile.daily_calorie_target}
            goal={profile.goal}
            today={todayStr}
            todayKcal={byDate.has(todayStr) ? Math.round(byDate.get(todayStr) ?? 0) : null}
            totalFatKg={Math.round(Math.max(0, totalDeficit / 7700) * 100) / 100}
            totalDaysLogged={completedDays}
            targetWeightKg={profile.target_weight_kg ?? null}
          />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
