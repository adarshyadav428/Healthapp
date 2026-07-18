// Per-user computation — never prerender.
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { suggestTargetAdjustment } from '../../../../lib/adaptiveTarget'
import { istDateStr } from '../../../../lib/dateUtils'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * This week's calorie-target suggestion, or `{ suggestion: null }`.
 *
 * Read-only on purpose: it never writes the new target. The user accepts it
 * explicitly (the client then goes through the normal profile-update path), so
 * nobody's calorie target changes underneath them because a cron ran. A wrong
 * silent adjustment is far more corrosive to trust than a missed one.
 */
export async function GET() {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('daily_calorie_target, pace_kg_per_week, goal')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.daily_calorie_target) return NextResponse.json({ suggestion: null })

    const weekAgo = new Date(Date.now() - 7 * DAY_MS).toISOString()

    // Weigh-ins across the window, oldest first, so the ends bracket the week.
    const { data: weights } = await supabase
      .from('weight_logs')
      .select('weight_kg, measured_at')
      .eq('user_id', user.id)
      .gte('measured_at', weekAgo)
      .order('measured_at', { ascending: true })

    // Two weigh-ins is the minimum that describes a change at all.
    if (!weights || weights.length < 2) return NextResponse.json({ suggestion: null })

    const actualKgChange = weights[weights.length - 1].weight_kg - weights[0].weight_kg

    const { data: logs } = await supabase
      .from('food_logs')
      .select('logged_at')
      .eq('user_id', user.id)
      .gte('logged_at', weekAgo)

    // Distinct IST days, so five logs in one evening don't look like five days.
    const daysLogged = new Set(
      (logs ?? []).map((l) => istDateStr(new Date(String(l.logged_at))))
    ).size

    const suggestion = suggestTargetAdjustment({
      currentTarget: profile.daily_calorie_target,
      actualKgChange,
      goalKgPerWeek: profile.pace_kg_per_week ?? 0.5,
      goal: (profile.goal ?? 'lose') as 'lose' | 'gain' | 'maintain',
      daysLogged,
    })

    return NextResponse.json({ suggestion })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
