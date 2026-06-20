import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6)
    sevenDaysAgo.setUTCHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('water_logs')
      .select('ml, logged_at')
      .eq('user_id', session.user.id)
      .gte('logged_at', sevenDaysAgo.toISOString())
      .order('logged_at', { ascending: true })

    if (error) throw new Error(error.message)

    // Aggregate by UTC date
    const byDay = new Map<string, number>()
    for (const log of data ?? []) {
      const d = new Date(log.logged_at)
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      byDay.set(key, (byDay.get(key) ?? 0) + log.ml)
    }

    // Build 7-day array
    const result: { date: string; ml: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - i)
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      result.push({ date: key, ml: byDay.get(key) ?? 0 })
    }

    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
