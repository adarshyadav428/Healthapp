import { NextResponse } from 'next/server'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { getIstDayRange } from '../../../../lib/dateUtils'
import { captureServerEvent } from '../../../../lib/posthog/server'
import { getLogActivationContext, toLogMilestone } from '../../../../lib/logActivation'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = user.id

    // Get yesterday's logs. "Yesterday" must be the IST calendar day (see
    // lib/dateUtils.ts) — the UTC day range copied the wrong day's logs for
    // anyone using the feature between IST midnight and 5:30 AM IST.
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const { start: yStart, end: yEnd } = getIstDayRange(yesterday)

    const { data: yesterdayLogs, error: fetchError } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_at', yStart)
      .lt('logged_at', yEnd)

    if (fetchError) throw new Error(fetchError.message)
    if (!yesterdayLogs || yesterdayLogs.length === 0) {
      return NextResponse.json({ error: 'No logs found for yesterday' }, { status: 404 })
    }

    // Count today's existing logs — feeds the alreadyHad field in the response.
    const { start: todayStart, end: todayEnd } = getIstDayRange()
    const { count: todayCount, error: countError } = await supabase
      .from('food_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('logged_at', todayStart)
      .lt('logged_at', todayEnd)

    if (countError) throw new Error(countError.message)

    const now = new Date().toISOString()

    // Copy all of yesterday's logs to today with current timestamp
    const newLogs = yesterdayLogs.map(({ id: _id, logged_at: _at, ...rest }) => ({
      ...rest,
      logged_at: now,
    }))

    const activation = await getLogActivationContext(supabase, user.id)

    const { error: insertError } = await supabase.from('food_logs').insert(newLogs)
    if (insertError) throw new Error(insertError.message)

    captureServerEvent(userId, 'meal_logged', {
      source: 'copy_yesterday',
      items: newLogs.length,
      is_first_log: activation.is_first_log,
      days_since_signup: activation.days_since_signup,
    })

    return NextResponse.json({
      ok: true,
      copied: newLogs.length,
      alreadyHad: todayCount ?? 0,
      milestone: toLogMilestone(activation, newLogs.length),
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
