import { NextResponse } from 'next/server'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { istDaysAgoStart } from '../../../../lib/dateUtils'
import { isProStatus } from '../../../../lib/subscription'
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

    const [{ data: sub }, { data: profile }] = await Promise.all([
      supabase.from('subscriptions').select('status').eq('user_id', user.id).maybeSingle(),
      supabase.from('profiles').select('created_at').eq('id', user.id).maybeSingle(),
    ])
    if (!isProStatus(sub?.status)) {
      const cutoff = istDaysAgoStart(limitsForSignupDate(profile?.created_at).historyDays)
      // ISO-8601 UTC strings compare correctly as strings
      if (!start || start < cutoff) start = cutoff
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
