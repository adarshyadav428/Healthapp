import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase/server'
import { weightLogSchema } from '../../../../lib/validations'
import { calculateTDEE } from '../../../../lib/tdee'

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser()

    if (sessionError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const json = await req.json()
    const parsed = weightLogSchema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

    const { data: row, error } = await supabase
      .from('weight_logs')
      .insert({
        user_id: user.id,
        weight_kg: parsed.data.weight_kg,
        measured_at: parsed.data.measured_at,
        notes: parsed.data.notes ?? '',
      })
      .select()
      .single()

    if (error) throw new Error(error.message)

    // Auto-recalculate calorie & macro targets when weight shifts ≥ 0.5 kg
    void (async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('current_weight_kg, height_cm, age, sex, activity_level, goal, pace_kg_per_week')
          .eq('id', user.id)
          .single()

        if (!profile) return
        const diff = Math.abs((profile.current_weight_kg ?? 0) - parsed.data.weight_kg)
        if (diff < 0.5) return // not significant enough to recalculate

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
      } catch { /* fire-and-forget — don't block the response */ }
    })()

    return NextResponse.json({ ok: true, row })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
