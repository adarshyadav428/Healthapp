import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/server'
import { getIstDayRange } from '../../../../lib/dateUtils'
import { calculateStreak } from '../../../../lib/streak'
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

    const streak = calculateStreak((recentLogs ?? []) as unknown as FoodLog[])

    const payload = streak > 0
      ? {
          title: `🔥 Don't lose your ${streak}-day streak!`,
          body: 'Log a meal before midnight to keep it going.',
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
