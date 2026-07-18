import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/server'
import { getIstDayRange } from '../../../../lib/dateUtils'
import { calculateStreakState } from '../../../../lib/streak'

/** Below this, a streak isn't worth a "don't lose it" notification yet. */
const STREAK_SAVE_MIN_DAYS = 3
import { sendPushToUser } from '../../../../lib/push/send'
import type { FoodLog } from '../../../../types/index'

export const runtime = 'nodejs'

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically when
// CRON_SECRET is set as an env var on the project — see vercel.json.
//
// Runs once daily in the evening (IST). For every user with an active push
// subscription who hasn't logged food yet today: sends a streak-save nudge
// if they have an active streak (higher urgency), otherwise a plain
// reminder. One send per user per run — never both, to avoid double-nagging.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: subRows, error: subError } = await admin.from('push_subscriptions').select('user_id')
  if (subError) return NextResponse.json({ error: subError.message }, { status: 500 })

  const userIds = [...new Set((subRows ?? []).map((r) => r.user_id as string))]
  if (userIds.length === 0) return NextResponse.json({ checked: 0, sent: 0 })

  const { start, end } = getIstDayRange()
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  let sent = 0

  for (const userId of userIds) {
    const { count } = await admin
      .from('food_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('logged_at', start)
      .lt('logged_at', end)

    if ((count ?? 0) > 0) continue // already logged today — no nudge needed

    const { data: recentLogs } = await admin
      .from('food_logs')
      .select('logged_at')
      .eq('user_id', userId)
      .gte('logged_at', sixtyDaysAgo)

    const { streak, freezesBanked } = calculateStreakState((recentLogs ?? []) as unknown as FoodLog[])

    // Only nudge about a streak once there's one worth protecting. Below 3 days
    // "don't lose your 1-day streak" is pressure without stakes, and it trains
    // people to swipe the notification away.
    const payload = streak >= STREAK_SAVE_MIN_DAYS
      ? {
          // Never alarming: if a freeze will cover tonight, say so. Manufacturing
          // panic about a streak we're about to save anyway is a lie.
          title: freezesBanked > 0
            ? `Your ${streak}-day streak is safe tonight`
            : `Keep your ${streak}-day streak going`,
          body: freezesBanked > 0
            ? 'A streak freeze has you covered — log a meal to save it for later.'
            : 'A quick log before midnight keeps it alive.',
          url: '/log',
          tag: 'streak-save',
        }
      : {
          title: "Still time to log today",
          body: 'A quick photo or a few words — takes 5 seconds.',
          url: '/log',
          tag: 'daily-reminder',
        }

    const result = await sendPushToUser(userId, payload)
    if (result.sent > 0) sent += 1
  }

  return NextResponse.json({ checked: userIds.length, sent })
}
