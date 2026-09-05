import { NextResponse } from 'next/server'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { weightLogSchema } from '../../../../lib/validations'
import { calculateTDEE } from '../../../../lib/tdee'
import { computeWeightMilestone } from '../../../../lib/weightMilestone'
import { insertIdempotent } from '../../../../lib/requestIdempotency'
import type { WeightLog } from '../../../../types/index'

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const json = await req.json()
    const parsed = weightLogSchema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

    // Snapshot the loss picture BEFORE the insert (two O(1) head-row reads,
    // in parallel) — feeds the whole-kg milestone celebration in the response.
    const [{ data: baselineRow }, { data: minRow }] = await Promise.all([
      supabase
        .from('weight_logs')
        .select('weight_kg, measured_at')
        .eq('user_id', user.id)
        .order('measured_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('weight_logs')
        .select('weight_kg')
        .eq('user_id', user.id)
        .order('weight_kg', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])

    // A rapid double-tap, a race between two near-simultaneous requests, or a
    // client retry after a timeout must not create a duplicate row — see
    // migration 046 and lib/requestIdempotency.ts. client_request_id is
    // generated once per modal-open, so a genuinely separate weigh-in (the
    // user reopens the form) always gets a fresh key and still goes through.
    const result = await insertIdempotent<WeightLog>(
      supabase,
      'weight_logs',
      user.id,
      {
        user_id: user.id,
        weight_kg: parsed.data.weight_kg,
        measured_at: parsed.data.measured_at,
        notes: parsed.data.notes ?? '',
        client_request_id: parsed.data.client_request_id ?? null,
      },
      '*'
    )
    if (!result.ok) throw new Error(result.error)
    const row = result.data

    // Auto-recalculate calorie & macro targets when weight shifts ≥ 0.5 kg.
    // Awaited, not fire-and-forget: a serverless function can be frozen the
    // moment the response is sent, so detached async work may never run.
    // It's two cheap queries; a recalc failure still shouldn't fail the
    // weight log itself (the insert above already succeeded).
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('current_weight_kg, height_cm, age, sex, activity_level, goal, pace_kg_per_week')
        .eq('id', user.id)
        .single()

      const diff = profile ? Math.abs((profile.current_weight_kg ?? 0) - parsed.data.weight_kg) : 0
      if (profile && diff >= 0.5) {
        const targets = calculateTDEE({
          weightKg: parsed.data.weight_kg,
          heightCm: profile.height_cm,
          age: profile.age,
          sex: profile.sex,
          activity_level: profile.activity_level,
          goal: profile.goal,
          paceKgPerWeek: profile.pace_kg_per_week ?? 0.5,
        })

        await supabase
          .from('profiles')
          .update({
            current_weight_kg: parsed.data.weight_kg,
            daily_calorie_target: targets.daily_calorie_target,
            protein_g_target: targets.protein_g_target,
            carbs_g_target: targets.carbs_g_target,
            fat_g_target: targets.fat_g_target,
          })
          .eq('id', user.id)
      }
    } catch { /* recalc is best-effort; the weight log itself succeeded */ }

    const milestone = computeWeightMilestone({
      baseline: baselineRow ?? null,
      minWeightKg: minRow?.weight_kg ?? null,
      entry: { weight_kg: parsed.data.weight_kg, measured_at: parsed.data.measured_at },
    })

    return NextResponse.json({ ok: true, row, milestone })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
