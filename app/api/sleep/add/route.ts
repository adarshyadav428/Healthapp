import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '../../../../lib/supabase/server'

const schema = z.object({
  sleep_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bedtime:    z.string(),   // ISO timestamp
  wake_time:  z.string(),   // ISO timestamp
  quality:    z.number().int().min(1).max(5).optional(),
  notes:      z.string().max(500).optional(),
})

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })

    const bedtime  = new Date(parsed.data.bedtime)
    const wakeTime = new Date(parsed.data.wake_time)
    if (isNaN(bedtime.getTime()) || isNaN(wakeTime.getTime())) {
      return NextResponse.json({ error: 'Invalid time values' }, { status: 400 })
    }
    if (wakeTime <= bedtime) {
      return NextResponse.json({ error: 'Wake time must be after bedtime' }, { status: 400 })
    }

    // Upsert: one log per user per sleep_date
    const { data: row, error } = await supabase
      .from('sleep_logs')
      .upsert(
        {
          user_id:    session.user.id,
          sleep_date: parsed.data.sleep_date,
          bedtime:    parsed.data.bedtime,
          wake_time:  parsed.data.wake_time,
          quality:    parsed.data.quality ?? null,
          notes:      parsed.data.notes ?? null,
        },
        { onConflict: 'user_id,sleep_date' }
      )
      .select()
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, row })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
