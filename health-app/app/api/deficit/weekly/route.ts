// Per-user endpoint — never prerender (paramless GET looks static to Next otherwise)
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { calculateMaintenance } from '../../../../lib/tdee'
import { groupKcalByIstDay, weekStartOf } from '../../../../lib/deficit-calculator'
import { istDateStr } from '../../../../lib/dateUtils'

export async function GET() {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_weight_kg, height_cm, age, sex, activity_level, pace_kg_per_week, target_weight_kg, daily_calorie_target')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    // Maintenance — from the shared helper, so this route can never drift from
    // what /progress and /deficit show.
    const { tdee } = calculateMaintenance({
      weightKg:       profile.current_weight_kg,
      heightCm:       profile.height_cm,
      age:            profile.age,
      sex:            profile.sex,
      activity_level: profile.activity_level,
    })

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
      .eq('user_id', user.id)
      .gte('logged_at', since)

    const byDate = groupKcalByIstDay(logs ?? [])

    const days = Array.from(byDate.entries())
      .map(([date, calories]) => ({ date, calories: Math.round(calories) }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const todayKey = istDateStr()

    return NextResponse.json({
      tdee,
      eat_target:           eatTarget,
      actual_daily_deficit: actualDailyDeficit,
      actual_weekly_target: actualWeeklyTarget,
      implied_pace_kg:      impliedPaceKg,
      target_weight_kg:     profile.target_weight_kg ?? null,
      today:                todayKey,
      week_start:           weekStartOf(todayKey),
      days,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
