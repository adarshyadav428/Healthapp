import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { insertIdempotent } from '../../../../lib/requestIdempotency'

const schema = z.object({
  activity:     z.string().min(1).max(100),
  duration_min: z.number().positive().max(600),
  calories:     z.number().int().positive().max(5000),
  // Generated once per logger-open on the client, not per HTTP call — lets
  // the server collapse a rapid double-tap, a race, or a timeout-retry of
  // the SAME submission into one row (lib/requestIdempotency.ts, migration
  // 046). Optional: an older client simply skips dedup.
  client_request_id: z.string().uuid().optional(),
})

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid data' }, { status: 400 })

    const { activity, duration_min, calories, client_request_id } = parsed.data
    const result = await insertIdempotent<{ id: string; activity: string; duration_min: number; calories: number; logged_at: string }>(
      supabase,
      'exercise_logs',
      user.id,
      { user_id: user.id, activity, duration_min, calories, client_request_id: client_request_id ?? null },
      'id, activity, duration_min, calories, logged_at'
    )
    if (!result.ok) throw new Error(result.error)

    return NextResponse.json({ ok: true, row: result.data })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
