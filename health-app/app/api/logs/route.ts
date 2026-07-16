import { NextResponse } from 'next/server'
import { createServerClient } from '../../../lib/supabase/server'
import { istDaysAgoStart } from '../../../lib/dateUtils'
import type { FoodLog } from '../../../types/index'

const FREE_HISTORY_DAYS = 7

export async function GET(req: Request) {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser()

    if (sessionError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    let start = searchParams.get('start')
    const end = searchParams.get('end')

    // Pro gate: the free tier's "7 days history" was only enforced by the UI —
    // the API itself returned unlimited history to anyone who called it.
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle()
    const isPro = Boolean(sub && (sub.status === 'active' || sub.status === 'trialing'))
    if (!isPro) {
      const cutoff = istDaysAgoStart(FREE_HISTORY_DAYS)
      // ISO-8601 UTC strings compare correctly as strings
      if (!start || start < cutoff) start = cutoff
    }

    let query = supabase
      .from('food_logs')
      .select('*, food:foods(*)')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })

    if (start) query = query.gte('logged_at', start)
    if (end) query = query.lt('logged_at', end)

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
