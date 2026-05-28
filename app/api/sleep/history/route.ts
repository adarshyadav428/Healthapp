import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    const startDate = sevenDaysAgo.toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('sleep_logs')
      .select('id, sleep_date, bedtime, wake_time, quality, notes')
      .eq('user_id', session.user.id)
      .gte('sleep_date', startDate)
      .order('sleep_date', { ascending: false })

    if (error) throw new Error(error.message)
    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
