// Per-user endpoint — never prerender (paramless GET looks static to Next otherwise)
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { getIsPro } from '../../../../lib/subscription'
import { limitsForSignupDate } from '../../../../lib/freeTier'
import type { WeightLog } from '../../../../types/index'

// `/upgrade` sells Pro "Advanced trends — full weight history". Until 2026-07-31
// this route capped EVERY tier at 30 rows with no Pro branch, so a paying user
// got no more history than a free one and a daily weigher hit the ceiling in a
// month. Free keeps a generous window (the weight chart needs enough points to
// show a trend at all) — sourced from lib/freeTier.ts; Pro is genuinely
// uncapped, which is what was sold.

export async function GET() {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [isPro, { data: profile }] = await Promise.all([
      getIsPro(supabase, user.id),
      supabase.from('profiles').select('created_at').eq('id', user.id).maybeSingle(),
    ])

    let query = supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('measured_at', { ascending: false })

    if (!isPro) query = query.limit(limitsForSignupDate(profile?.created_at).weightRows)

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
