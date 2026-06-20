import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '../../../../lib/supabase/server'

const schema = z.object({
  target_hours: z.number().min(1).max(72),
})

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })

    // Make sure no active session exists
    const { data: existing } = await supabase
      .from('fasting_sessions')
      .select('id')
      .eq('user_id', session.user.id)
      .is('ended_at', null)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'A fast is already in progress. Stop it first.' }, { status: 409 })
    }

    const { data: row, error } = await supabase
      .from('fasting_sessions')
      .insert({ user_id: session.user.id, target_hours: parsed.data.target_hours })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, row })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
