import { NextResponse } from 'next/server'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { REMINDER_HOURS } from '../../../../lib/reminderSchedule'

export const runtime = 'nodejs'

/**
 * Set the IST hour at which this user's daily reminder should fire.
 *
 * Its own route rather than a field on /api/profile/update, because that
 * endpoint's schema requires the whole profile (name, height, weights, goal) —
 * making a dropdown round-trip all of it invites a stale form overwriting a
 * value the user changed on another screen.
 *
 * The accepted set is REMINDER_HOURS, not 0-23: the schedule can only honour
 * hours up to the catch-all cron, and accepting an hour we would silently never
 * fire is how a setting becomes a lie. See lib/reminderSchedule.
 */
export async function POST(req: Request) {
  const supabase = createServerClient()
  const user = await getApiUser(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const hour = body?.hour

  if (typeof hour !== 'number' || !Number.isInteger(hour) || !REMINDER_HOURS.includes(hour)) {
    return NextResponse.json(
      { error: 'Pick a reminder time from the list.' },
      { status: 400 }
    )
  }

  const { error } = await supabase
    .from('profiles')
    .update({ reminder_hour: hour })
    .eq('id', user.id)

  // Checked, not discarded: a silently-failed write means the user sets a time,
  // sees it accepted, and keeps getting the old one — with nothing to say why.
  if (error) {
    return NextResponse.json({ error: 'Could not save your reminder time.' }, { status: 500 })
  }

  return NextResponse.json({ hour })
}
