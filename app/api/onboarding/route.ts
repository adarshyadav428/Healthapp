import { NextResponse } from 'next/server'
import { onboardingSchema } from '../../../lib/validations'
import { createServerClient } from '../../../lib/supabase/server'
import { calculateTDEE } from '../../../lib/tdee'

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const {
      data: { session },
      error: userError,
    } = await supabase.auth.getSession()
    const user = session?.user ?? null

    if (userError) throw new Error(userError.message)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const json = await req.json()
    const parsed = onboardingSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const data = parsed.data
    const macros = calculateTDEE({
      weightKg: data.current_weight_kg,
      heightCm: data.height_cm,
      age: data.age,
      sex: data.sex,
      activity_level: data.activity_level,
      goal: data.goal,
      paceKgPerWeek: data.pace_kg_per_week,
    })

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: data.display_name,
        unit_system: data.unit_system,
        age: data.age,
        sex: data.sex,
        height_cm: data.height_cm,
        current_weight_kg: data.current_weight_kg,
        target_weight_kg: data.target_weight_kg,
        goal: data.goal,
        activity_level: data.activity_level,
        daily_calorie_target: macros.daily_calorie_target,
        protein_g_target: macros.protein_g_target,
        carbs_g_target: macros.carbs_g_target,
        fat_g_target: macros.fat_g_target,
      })
      .eq('id', user.id)

    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
