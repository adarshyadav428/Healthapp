import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '../../../../lib/supabase/server'

const schema = z.object({
  ml: z.number().int().min(1).max(2000),
})

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid data' }, { status: 400 })

    const { data, error } = await supabase
      .from('water_logs')
      .insert({ user_id: session.user.id, ml: parsed.data.ml })
      .select('id, ml, logged_at')
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, row: data })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
