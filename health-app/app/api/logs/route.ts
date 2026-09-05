import { NextResponse } from 'next/server'
import { createServerClient, getApiUser } from '../../../lib/supabase/server'
import { istDaysAgoStart, clampHistoryStart } from '../../../lib/dateUtils'
import { getIsPro } from '../../../lib/subscription'
import { limitsForSignupDate } from '../../../lib/freeTier'
import type { FoodLog } from '../../../types/index'

// Same column list the server pages use — `foods(*)` shipped every column of
// every food row on each refetch, which is dead weight on mobile connections.
const FOOD_SELECT =
  'id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, common_portions'

export async function GET(req: Request) {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    let start = searchParams.get('start')
    const end = searchParams.get('end')

    // Pro gate: the free tier's "7 days history" was only enforced by the UI —
    // the API itself returned unlimited history to anyone who called it. The
    // free window is keyed on signup cohort (lib/freeTier.ts); profiles.created_at
    // rides the same round trip as the sub read.
    const [isPro, { data: profile }] = await Promise.all([
      getIsPro(supabase, user.id),
      supabase.from('profiles').select('created_at').eq('id', user.id).maybeSingle(),
    ])
    // `start` is untrusted input and must be a real timestamp whatever the tier —
    // an unparseable one would otherwise reach Postgres as a literal.
    if (start && !Number.isFinite(Date.parse(start))) {
      return NextResponse.json({ error: 'Invalid start date' }, { status: 400 })
    }

    if (!isPro) {
      const cutoff = istDaysAgoStart(limitsForSignupDate(profile?.created_at).historyDays)
      // Compares parsed instants, never strings — see clampHistoryStart for why
      // `?start=epoch` used to defeat this entirely.
      start = clampHistoryStart(start, cutoff)
      if (start === null) return NextResponse.json({ error: 'Invalid start date' }, { status: 400 })
    }

    let query = supabase
      .from('food_logs')
      .select(`*, food:foods(${FOOD_SELECT})`)
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
