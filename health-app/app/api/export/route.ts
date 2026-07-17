// Per-user endpoint — never prerender (paramless GET looks static to Next otherwise)
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '../../../lib/supabase/server'
import { csvEscape } from '../../../lib/csv'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userId = user.id

    // Fetch last 90 days of food logs
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90)

    const [foodResult, weightResult] = await Promise.all([
      supabase
        .from('food_logs')
        .select('logged_at, meal, kcal, protein_g, carbs_g, fat_g, grams, food:foods(name, brand)')
        .eq('user_id', userId)
        .gte('logged_at', ninetyDaysAgo.toISOString())
        .order('logged_at', { ascending: true }),
      supabase
        .from('weight_logs')
        .select('measured_at, weight_kg')
        .eq('user_id', userId)
        .order('measured_at', { ascending: true }),
    ])

    if (foodResult.error) throw new Error(foodResult.error.message)
    if (weightResult.error) throw new Error(weightResult.error.message)

    const foodLogs = foodResult.data ?? []
    const weightLogs = weightResult.data ?? []

    // Timestamps are rendered in IST (the day-definition used everywhere in the
    // app) so an Indian user's 6:58 AM breakfast doesn't export as "01:28" UTC.
    const IST = 'Asia/Kolkata'
    const istDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: IST })
    const istTime = (iso: string) =>
      new Date(iso).toLocaleTimeString('en-GB', { timeZone: IST, hour: '2-digit', minute: '2-digit', hour12: false })

    // Build CSV
    const rows: string[] = [
      '# GetInShape Food Log Export (last 90 days)',
      '# Generated: ' + new Date().toISOString() + ' — all times below are IST',
      '',
      'Date (IST),Time (IST),Meal,Food,Brand,Grams,Calories,Protein(g),Carbs(g),Fat(g)',
    ]

    for (const log of foodLogs) {
      const date = istDate(log.logged_at)
      const time = istTime(log.logged_at)
      const food = (log.food as { name?: string; brand?: string } | null)
      const name = csvEscape(food?.name ?? 'Unknown')
      const brand = csvEscape(food?.brand ?? '')
      rows.push(`${date},${time},${log.meal},${name},${brand},${log.grams},${Math.round(log.kcal)},${log.protein_g},${log.carbs_g},${log.fat_g}`)
    }

    rows.push('', '# Weight Log', 'Date (IST),Weight(kg)')
    for (const log of weightLogs) {
      rows.push(`${istDate(log.measured_at)},${log.weight_kg}`)
    }

    const csv = rows.join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="getinshape-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
