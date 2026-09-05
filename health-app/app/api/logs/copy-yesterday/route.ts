import { NextResponse } from 'next/server'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { getIstDayRange } from '../../../../lib/dateUtils'
import { captureFoodLogged } from '../../../../lib/posthog/server'
import { getLogActivationContext, toLogMilestone } from '../../../../lib/logActivation'
import { streakEventsForLog } from '../../../../lib/streakEvents'

export const runtime = 'nodejs'

export async function POST(req: Request) {
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

    // A rapid double-tap, a race between two near-simultaneous requests, or a
    // retry after a dropped response must not duplicate yesterday's logs a
    // second time. copied_from_id (migration 047) records which source row
    // each copy came from, unique per row — so a source row already copied
    // is filtered out here (the common case: no conflict, no wasted insert
    // attempt) and any that slip through a genuine race are caught by the
    // unique index itself below. This also makes a partial retry correct: if
    // a new item was added to yesterday between two calls, only the new one
    // gets copied, not a second copy of what already went through.
    // 2026-09-05 adversarial-audit F4.
    const sourceIds = yesterdayLogs.map((l) => l.id as string)
    const { data: alreadyCopiedRows, error: alreadyCopiedError } = await supabase
      .from('food_logs')
      .select('copied_from_id')
      .eq('user_id', userId)
      .in('copied_from_id', sourceIds)
    if (alreadyCopiedError) throw new Error(alreadyCopiedError.message)
    const alreadyCopiedSet = new Set((alreadyCopiedRows ?? []).map((r) => r.copied_from_id as string))

    const now = new Date().toISOString()

    // Copy whichever of yesterday's logs have not already been copied, to
    // today, with the current timestamp.
    const newLogs = yesterdayLogs
      .filter((log) => !alreadyCopiedSet.has(log.id as string))
      .map(({ id, logged_at: _at, ...rest }) => ({
        ...rest,
        logged_at: now,
        copied_from_id: id,
      }))

    if (newLogs.length === 0) {
      return NextResponse.json({
        ok: true,
        copied: 0,
        alreadyCopied: true,
        alreadyHad: todayCount ?? 0,
      })
    }

    const activation = await getLogActivationContext(supabase, user.id)

    const { error: insertError } = await supabase.from('food_logs').insert(newLogs)
    if (insertError) {
      // A unique-constraint hit here means another request copied these same
      // source rows in the gap between our check above and this insert — a
      // genuine race, not a real failure. Treat it the same as "already
      // copied" rather than erroring the second request.
      if (insertError.code === '23505') {
        return NextResponse.json({
          ok: true,
          copied: 0,
          alreadyCopied: true,
          alreadyHad: todayCount ?? 0,
        })
      }
      throw new Error(insertError.message)
    }

    // 'mixed': copy-yesterday spans whatever meals yesterday had, so there is
    // no single honest meal slot to report.
    captureFoodLogged(userId, req, 'copy_yesterday', {
      meal: 'mixed',
      items: newLogs.length,
      isFirstLog: activation.is_first_log,
      daysSinceSignup: activation.days_since_signup,
      streakEvents: streakEventsForLog(activation.logs_before, now, activation.rescued_dates),
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
