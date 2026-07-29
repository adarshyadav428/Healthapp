import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/server'
import { getIstDayRange } from '../../../../lib/dateUtils'
import { calculateStreakState } from '../../../../lib/streak'

/** Below this, a streak isn't worth a "don't lose it" notification yet. */
const STREAK_SAVE_MIN_DAYS = 3
import { sendPushToUser } from '../../../../lib/push/send'
import { processInBatches, CRON_TIME_BUDGET_MS } from '../../../../lib/cronBatch'
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
  const startedAt = Date.now()

  // Two batched reads instead of two queries PER USER. The old shape made
  // 2 x N round trips inside a serial loop, which at a few thousand users
  // exceeded the function timeout and silently stopped pushing partway
  // through — with no error anywhere to say so.
  const [{ data: windowLogs }, { data: rescueRows }] = await Promise.all([
    admin.from('food_logs').select('user_id, logged_at').in('user_id', userIds).gte('logged_at', sixtyDaysAgo),
    admin.from('streak_rescues').select('user_id, rescued_date').in('user_id', userIds),
  ])

  const logsByUser = new Map<string, { logged_at: string }[]>()
  const loggedTodayIds = new Set<string>()
  for (const row of windowLogs ?? []) {
    const uid = row.user_id as string
    const at = row.logged_at as string
    const arr = logsByUser.get(uid) ?? []
    arr.push({ logged_at: at })
    logsByUser.set(uid, arr)
    if (at >= start && at < end) loggedTodayIds.add(uid)
  }

  const rescuesByUser = new Map<string, string[]>()
  for (const row of rescueRows ?? []) {
    const uid = row.user_id as string
    const arr = rescuesByUser.get(uid) ?? []
    arr.push(row.rescued_date as string)
    rescuesByUser.set(uid, arr)
  }

  // Already logged today — no nudge needed.
  const pending = userIds.filter((uid) => !loggedTodayIds.has(uid))

  const outcome = await processInBatches(pending, async (userId) => {
    const { streak, freezesBanked } = calculateStreakState(
      (logsByUser.get(userId) ?? []) as unknown as FoodLog[],
      new Date(),
      rescuesByUser.get(userId) ?? []
    )

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
  }, { deadline: startedAt + CRON_TIME_BUDGET_MS })

  return NextResponse.json({
    checked: userIds.length,
    eligible: pending.length,
    sent,
    remaining: outcome.remaining,
    timedOut: outcome.timedOut,
    failed: outcome.failed,
  })
}
