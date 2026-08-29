// Per-user endpoint — never prerender (paramless GET looks static to Next otherwise)
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase/server'
import { computeWeightTrend } from '../../../../lib/weightTrend'
import { goalProjection, goalProjectionCopy } from '../../../../lib/goalProjection'

export const runtime = 'nodejs'

/**
 * The self-proof line the 3rd-log paywall interstitial shows: "On track for
 * {target} kg around {date}". Read-only — no write.
 *
 * Deliberately reuses the honest measured-vs-planned gate (lib/goalProjection),
 * not /upgrade's naive `projectGoalDate(pace ?? 0.5)`. When the user is
 * off-track, flat, or has no weigh-ins, `goalProjectionCopy` returns null and
 * the interstitial shows no line — it must never assert a date it can't stand
 * behind, especially to someone who has just weighed themselves.
 *
 * Fired lazily by LogMilestones only when the interstitial is about to show,
 * the same pattern as its isPlayBillingAvailable() probe — so it costs nothing
 * on the vast majority of logs.
 */
export async function GET() {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [profileResult, weightResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('current_weight_kg, target_weight_kg, pace_kg_per_week')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('weight_logs')
        .select('weight_kg, measured_at')
        .eq('user_id', user.id)
        .gte('measured_at', new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString())
        .order('measured_at', { ascending: false }),
    ])

    const profile = profileResult.data as
      | { current_weight_kg: number | null; target_weight_kg: number | null; pace_kg_per_week: number | null }
      | null
    if (!profile || profile.target_weight_kg == null) {
      return NextResponse.json({ projection: null })
    }

    const weighIns = (weightResult.data ?? []) as { weight_kg: number; measured_at: string }[]
    const trend = computeWeightTrend(weighIns, profile.target_weight_kg)
    const projection = goalProjection({
      currentKg: weighIns[0]?.weight_kg ?? profile.current_weight_kg ?? null,
      targetKg: profile.target_weight_kg,
      paceKgPerWeek: profile.pace_kg_per_week ?? null,
      trend,
    })

    const copy = goalProjectionCopy(projection, profile.target_weight_kg)
    return NextResponse.json({
      projection: copy ? { headline: copy.headline, kind: projection.kind } : null,
    })
  } catch (err) {
    // The interstitial degrades to no line on any failure — never block it.
    return NextResponse.json({ projection: null, error: (err as Error).message }, { status: 200 })
  }
}
