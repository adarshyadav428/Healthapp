import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient, getAuthedUser } from '../../../../lib/supabase/server'
import { isProStatus } from '../../../../lib/subscription'
import { findStreakRescue } from '../../../../lib/streak'
import { rescuesRemaining } from '../../../../lib/streakRescue'
import { captureServerEvent } from '../../../../lib/posthog/server'
import type { FoodLog } from '../../../../types/index'

export const runtime = 'nodejs'

/**
 * Spend a Streak Rescue.
 *
 * The server picks the day, not the client: which break is repairable is a
 * function of the log history and the freeze rules, and letting a request name
 * its own date would let anyone bridge an arbitrary gap. The client's only job
 * is to ask.
 *
 * Insert goes through the service-role client because migration 028
 * deliberately grants users no insert policy — Pro status, the monthly
 * allowance and "is this day genuinely rescuable" are all checked here.
 */
export async function POST() {
  const supabase = createServerClient()
  const user = await getAuthedUser(supabase)

  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  const [subResult, logsResult, rescuesResult] = await Promise.all([
    supabase.from('subscriptions').select('status').eq('user_id', user.id).maybeSingle(),
    supabase.from('food_logs').select('logged_at').eq('user_id', user.id).gte('logged_at', sixtyDaysAgo),
    supabase.from('streak_rescues').select('rescued_date, created_at').eq('user_id', user.id),
  ])

  if (!isProStatus(subResult.data?.status)) {
    return NextResponse.json({ error: 'Streak Rescue is a Pro feature.' }, { status: 403 })
  }

  // A failed read must not hand out a free rescue — an empty list would look
  // like a full allowance. Same fail-closed reasoning as the AI trial counter.
  if (rescuesResult.error) {
    return NextResponse.json({ error: 'Could not check your rescues. Try again.' }, { status: 500 })
  }

  const rescues = rescuesResult.data ?? []
  const remaining = rescuesRemaining(rescues.map((r) => r.created_at as string))
  if (remaining <= 0) {
    return NextResponse.json(
      { error: 'You’ve used this month’s Streak Rescue. You’ll get another next month.' },
      { status: 409 }
    )
  }

  const found = findStreakRescue(
    (logsResult.data ?? []) as unknown as FoodLog[],
    new Date(),
    rescues.map((r) => r.rescued_date as string)
  )
  if (!found) {
    return NextResponse.json({ error: 'There’s no broken streak to rescue right now.' }, { status: 409 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('streak_rescues')
    .insert({ user_id: user.id, rescued_date: found.date })

  if (error) {
    // The unique constraint makes a double-submit idempotent rather than
    // burning the month's allowance twice.
    if (error.code === '23505') {
      return NextResponse.json({ ok: true, date: found.date, streak: found.streakAfter })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  captureServerEvent(user.id, 'streak_rescue_used', {
    date: found.date,
    streak_after: found.streakAfter,
  })

  return NextResponse.json({ ok: true, date: found.date, streak: found.streakAfter })
}
