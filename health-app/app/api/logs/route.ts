import { NextResponse } from 'next/server'
import { createServerClient } from '../../../lib/supabase/server'
import type { FoodLog } from '../../../types/index'

export async function GET(req: Request) {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser()

    if (sessionError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    let query = supabase
      .from('food_logs')
      .select('*, food:foods(*)')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })

    if (start) query = query.gte('logged_at', start)
    if (end) query = query.lt('logged_at', end)

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
