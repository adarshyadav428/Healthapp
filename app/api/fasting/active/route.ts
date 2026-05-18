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
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return NextResponse.json(data ?? null)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
