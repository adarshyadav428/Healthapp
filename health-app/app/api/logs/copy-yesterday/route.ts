import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase/server'
import { getUtcDayRange } from '../../../../lib/dateUtils'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = session.user.id

    // Get yesterday's logs
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const { start: yStart, end: yEnd } = getUtcDayRange(yesterday)

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

    // Check today's log count (free tier limit is 5)
    const { start: todayStart, end: todayEnd } = getUtcDayRange()
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

    const { error: insertError } = await supabase.from('food_logs').insert(newLogs)
    if (insertError) throw new Error(insertError.message)

    return NextResponse.json({
      ok: true,
      copied: newLogs.length,
      alreadyHad: todayCount ?? 0,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
