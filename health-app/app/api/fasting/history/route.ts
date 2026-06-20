import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('fasting_sessions')
      .select('id, started_at, ended_at, target_hours')
      .eq('user_id', session.user.id)
      .not('ended_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(10)

    if (error) throw new Error(error.message)
    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
