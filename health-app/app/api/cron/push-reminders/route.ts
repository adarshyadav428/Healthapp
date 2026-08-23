import { NextResponse } from 'next/server'
import { createAdminClient } from '../../../../lib/supabase/server'
import { getIstDayRange } from '../../../../lib/dateUtils'
import { calculateStreakState } from '../../../../lib/streak'


/** Below this, a streak isn't worth a "don't lose it" notification yet. */
const STREAK_SAVE_MIN_DAYS = 3

import { sendBudgetedPush } from '../../../../lib/push/budgetedSend'
import {
  DEFAULT_REMINDER_HOUR,
  isReminderDue,
  istHour,
  normaliseReminderHour,
  type ReminderSlot,
} from '../../../../lib/reminderSchedule'
import { processInBatches, CRON_TIME_BUDGET_MS } from '../../../../lib/cronBatch'
import type { FoodLog } from '../../../../types/index'

export const runtime = 'nodejs'

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically when
// CRON_SECRET is set as an env var on the project — see vercel.json.
//
// Two callers, distinguished by ?slot=:
//
//   (default) CATCH-ALL — the Vercel cron, once daily at 20:30 IST. Serves
//     everyone who hasn't logged today, regardless of their chosen hour. This
//     is the pre-036 behaviour and it is the floor: choosing a reminder time
//     can improve when the nudge lands, never cost you the nudge.
//   slot=hourly — the GitHub Actions tick. Serves only users whose chosen IST
//     hour is the current one, which is what makes the setting real.
//
// Both go through sendBudgetedPush, and the budget is one push per user per
// day — so the two callers can never double-nag, in either order.
//
// For every user served: a streak-save nudge if they have a streak worth
// protecting (higher urgency), else a plain reminder.
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const slot: ReminderSlot =
    new URL(req.url).searchParams.get('slot') === 'hourly' ? 'hourly' : 'catch-all'
  const nowIstHour = istHour()

  const { data: subRows, error: subError } = await admin.from('push_subscriptions').select('user_id')
  if (subError) return NextResponse.json({ error: subError.message }, { status: 500 })

  const userIds = [...new Set((subRows ?? []).map((r) => r.user_id as string))]
  if (userIds.length === 0) return NextResponse.json({ checked: 0, sent: 0, slot })

  // Chosen reminder hours. Failing loudly rather than defaulting: on an hourly
  // tick a silent fallback would push everyone whose default happens to match
  // the current hour, which is a mass mis-timed send dressed as a no-op.
  const { data: hourRows, error: hourError } = await admin
    .from('profiles')
    .select('id, reminder_hour')
    .in('id', userIds)
  if (hourError) return NextResponse.json({ error: hourError.message }, { status: 500 })

  const hourByUser = new Map<string, number>()
  for (const row of hourRows ?? []) {
    hourByUser.set(row.id as string, normaliseReminderHour(row.reminder_hour))
  }

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

  // Already logged today — no nudge needed. Then: is this their hour? The
  // catch-all answers yes for everyone, so this only narrows the hourly tick.
  const pending = userIds.filter(
    (uid) =>
      !loggedTodayIds.has(uid) &&
      isReminderDue({
        reminderHour: hourByUser.get(uid) ?? DEFAULT_REMINDER_HOUR,
        nowIstHour,
        slot,
      })
  )

  const outcome = await processInBatches(pending, async (userId) => {
    const { streak, freezesBanked } = calculateStreakState(
      (logsByUser.get(userId) ?? []) as unknown as FoodLog[],
      new Date(),
      rescuesByUser.get(userId) ?? []
    )

    // Only nudge about a streak once there's one worth protecting. Below 3 days
    // "don't lose your 1-day streak" is pressure without stakes, and it trains
    // people to swipe the notification away.
    // Priority ladder, in the order lib/pushBudget.ts declares it:
    // streak-save > daily-reminder. The budget allows one push a day, so this
    // picks the most urgent thing we have to say — it never sends two.
    const kind = streak >= STREAK_SAVE_MIN_DAYS
      ? 'streak-save' as const
      : 'daily-reminder' as const

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

    const result = await sendBudgetedPush(userId, streak >= STREAK_SAVE_MIN_DAYS ? 'streak-save' : 'daily-reminder', payload)
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
