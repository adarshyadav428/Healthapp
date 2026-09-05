import { NextResponse } from 'next/server'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { istDaysAgoStart, clampHistoryStart } from '../../../../lib/dateUtils'
import { getIsPro } from '../../../../lib/subscription'
import { limitsForSignupDate } from '../../../../lib/freeTier'

// Range variant of /api/exercise/today, with the same free-tier history clamp
// as /api/logs so the limit holds no matter which endpoint is called.
export async function GET(req: Request) {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    let start = searchParams.get('start')
    const end = searchParams.get('end')

    const [isPro, { data: profile }] = await Promise.all([
      getIsPro(supabase, user.id),
      supabase.from('profiles').select('created_at').eq('id', user.id).maybeSingle(),
    ])
    // `start` is untrusted input and must be a real timestamp whatever the tier —
    // an unparseable one would otherwise reach Postgres as a literal.
    if (start && !Number.isFinite(Date.parse(start))) {
      return NextResponse.json({ error: 'Invalid start date' }, { status: 400 })
    }

    if (!isPro) {
      const cutoff = istDaysAgoStart(limitsForSignupDate(profile?.created_at).historyDays)
      // Compares parsed instants, never strings — see clampHistoryStart for why
      // `?start=epoch` used to defeat this entirely.
      start = clampHistoryStart(start, cutoff)
      if (start === null) return NextResponse.json({ error: 'Invalid start date' }, { status: 400 })
    }

    let query = supabase
      .from('exercise_logs')
      .select('id, activity, duration_min, calories, logged_at')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: true })

    if (start) query = query.gte('logged_at', start)
    if (end) query = query.lt('logged_at', end)

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
