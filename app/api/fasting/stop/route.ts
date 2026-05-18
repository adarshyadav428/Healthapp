import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase/server'

export async function POST() {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: active } = await supabase
      .from('fasting_sessions')
      .select('id')
      .eq('user_id', session.user.id)
      .is('ended_at', null)
      .maybeSingle()

    if (!active) return NextResponse.json({ error: 'No active fast found' }, { status: 404 })

    const { error } = await supabase
      .from('fasting_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', active.id)
      .eq('user_id', session.user.id)

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
