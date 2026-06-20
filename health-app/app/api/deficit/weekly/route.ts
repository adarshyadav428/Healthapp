import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase/server'
import { calculateBMR, activityMultiplier } from '../../../../lib/tdee'

// Indian Standard Time = UTC + 5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

function toIstDateKey(isoString: string): string {
  return new Date(new Date(isoString).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

function getMondayOfWeek(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00Z')
  const day = d.getUTCDay()
  const daysFromMon = day === 0 ? 6 : day - 1
  return new Date(d.getTime() - daysFromMon * 86_400_000).toISOString().slice(0, 10)
}

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_weight_kg, height_cm, age, sex, activity_level, pace_kg_per_week, target_weight_kg, daily_calorie_target')
      .eq('id', session.user.id)
      .maybeSingle()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    // Maintenance TDEE — what the body burns at rest + activity, before any deficit
    const bmr = calculateBMR({
      weightKg: profile.current_weight_kg,
      heightCm: profile.height_cm,
      age:      profile.age,
      sex:      profile.sex,
    })
    const tdee = Math.round(bmr * activityMultiplier(profile.activity_level))

    // Use the stored daily_calorie_target — same number the dashboard ring shows.
    // This is the ONLY truth. Never recompute from pace here.
    const eatTarget = profile.daily_calorie_target

    // Actual deficit implied by the eat target vs maintenance
    const actualDailyDeficit  = Math.max(0, tdee - eatTarget)
    const actualWeeklyTarget  = actualDailyDeficit * 7
    // How many kg/week that deficit represents (for display only)
    const impliedPaceKg = actualWeeklyTarget > 0
      ? Math.round(actualWeeklyTarget / 7700 * 100) / 100
      : 0

    // Fetch last 28 days of logs
    const since = new Date(Date.now() - 28 * 86_400_000).toISOString()
    const { data: logs } = await supabase
      .from('food_logs')
      .select('kcal, logged_at')
      .eq('user_id', session.user.id)
      .gte('logged_at', since)

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

    return NextResponse.json({
      tdee,
      eat_target:           eatTarget,
      actual_daily_deficit: actualDailyDeficit,
      actual_weekly_target: actualWeeklyTarget,
      implied_pace_kg:      impliedPaceKg,
      target_weight_kg:     profile.target_weight_kg ?? null,
      today:                todayKey,
      week_start:           getMondayOfWeek(todayKey),
      days,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
