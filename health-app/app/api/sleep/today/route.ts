import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const today = new Date().toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('sleep_logs')
      .select('id, sleep_date, bedtime, wake_time, quality, notes')
      .eq('user_id', session.user.id)
      .eq('sleep_date', today)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return NextResponse.json(data ?? null)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
