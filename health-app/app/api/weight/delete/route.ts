import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase/server'
import { z } from 'zod'

const schema = z.object({ id: z.string().uuid() })

export async function DELETE(req: Request) {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser()

    if (sessionError) throw new Error(sessionError.message)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const json = await req.json()
    const parsed = schema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

    const { error } = await supabase
      .from('weight_logs')
      .delete()
      .eq('id', parsed.data.id)
      .eq('user_id', user.id)

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
