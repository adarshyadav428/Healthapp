import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'

const schema = z.object({
  activity:     z.string().min(1).max(100),
  duration_min: z.number().positive().max(600),
  calories:     z.number().int().positive().max(5000),
})

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid data' }, { status: 400 })

    const { data, error } = await supabase
      .from('exercise_logs')
      .insert({ user_id: user.id, ...parsed.data })
      .select('id, activity, duration_min, calories, logged_at')
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, row: data })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
