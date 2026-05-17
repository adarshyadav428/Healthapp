import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '../../../lib/supabase/server'

const addSchema = z.object({
  waist_cm:    z.number().positive().optional(),
  chest_cm:    z.number().positive().optional(),
  hips_cm:     z.number().positive().optional(),
  arms_cm:     z.number().positive().optional(),
  measured_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const deleteSchema = z.object({ id: z.string().uuid() })

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('measurements_logs')
      .select('*')
      .eq('user_id', session.user.id)
      .order('measured_at', { ascending: false })
      .limit(30)

    if (error) throw new Error(error.message)
    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = addSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })

    const today = new Date().toISOString().slice(0, 10)
    const { data: row, error } = await supabase
      .from('measurements_logs')
      .insert({ user_id: session.user.id, ...parsed.data, measured_at: parsed.data.measured_at ?? today })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, row })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = deleteSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const { error } = await supabase
      .from('measurements_logs')
      .delete()
      .eq('id', parsed.data.id)
      .eq('user_id', session.user.id)

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
