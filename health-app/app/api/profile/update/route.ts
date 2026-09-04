import { NextResponse } from 'next/server'
import { profileUpdateSchema } from '../../../../lib/validations'
import { createServerClient } from '../../../../lib/supabase/server'
import { calculateTDEE } from '../../../../lib/tdee'
import { planForFocus, focusFromProfile } from '../../../../lib/bodyType'

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const json = await req.json()
    const parsed = profileUpdateSchema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('age, sex, target_weight_kg')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) throw new Error(profileError.message)
    if (!currentProfile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    if (!currentProfile.age || !currentProfile.sex) {
      return NextResponse.json({ error: 'Profile missing age or sex' }, { status: 400 })
    }

    // Same derivation as the onboarding route: `body_focus` is what the user
    // picked, `goal` and the pace come out of `planForFocus`. A client that
    // sends no focus falls back to its own goal, so nothing older breaks.
    const focus = parsed.data.body_focus ?? focusFromProfile({ goal: parsed.data.goal })
    const plan = planForFocus(focus)
    const goal = plan.goal
    const pace_kg_per_week = plan.pace ?? parsed.data.pace_kg_per_week

    const hasCustomTargets =
      parsed.data.custom_calorie_target !== undefined &&
      parsed.data.custom_protein_target !== undefined &&
      parsed.data.custom_carbs_target  !== undefined &&
      parsed.data.custom_fat_target    !== undefined

    // Use custom targets when all four are provided; otherwise recalculate from TDEE
    const targets = hasCustomTargets
      ? {
          daily_calorie_target: parsed.data.custom_calorie_target!,
          protein_g_target:     parsed.data.custom_protein_target!,
          carbs_g_target:       parsed.data.custom_carbs_target!,
          fat_g_target:         parsed.data.custom_fat_target!,
        }
      : calculateTDEE({
          weightKg:        parsed.data.current_weight_kg,
          heightCm:        parsed.data.height_cm,
          age:             currentProfile.age,
          sex:             currentProfile.sex,
          activity_level:  parsed.data.activity_level,
          goal,
          paceKgPerWeek:   pace_kg_per_week,
        })

    const payload = {
      display_name:         parsed.data.display_name,
      height_cm:            parsed.data.height_cm,
      current_weight_kg:    parsed.data.current_weight_kg,
      target_weight_kg:     parsed.data.target_weight_kg,
      activity_level:       parsed.data.activity_level,
      goal,
      daily_calorie_target: targets.daily_calorie_target,
      protein_g_target:     targets.protein_g_target,
      carbs_g_target:       targets.carbs_g_target,
      fat_g_target:         targets.fat_g_target,
      ...(pace_kg_per_week !== undefined ? { pace_kg_per_week } : {}),
    }

    const { error } = await supabase
      .from('profiles')
      .update({ ...payload, body_focus: focus })
      .eq('id', user.id)

    if (error) {
      // `body_focus` can be missing on a database that predates migration 040,
      // so a failure naming it retries without it rather than losing the whole
      // update. The retry used to also drop `water_target_ml`; that field no
      // longer reaches this route at all (P2-3).
      const msg = String(error.message)
      if (msg.includes('body_focus')) {
        const { error: retryError } = await supabase
          .from('profiles')
          .update(payload)
          .eq('id', user.id)
        if (retryError) throw new Error(retryError.message)
      } else {
        throw new Error(error.message)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
