import { NextResponse } from 'next/server'
import { onboardingSchema } from '../../../lib/validations'
import { createServerClient } from '../../../lib/supabase/server'
import { calculateTDEE } from '../../../lib/tdee'
import { planForFocus, focusFromProfile } from '../../../lib/bodyType'
import { captureServerEvent } from '../../../lib/posthog/server'

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const json = await req.json()
    const parsed = onboardingSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const data = parsed.data

    // `body_focus` is what the user picked; `goal` and the pace are derived
    // from it here rather than trusted from the client, the same way the
    // macros are. A client that predates migration 040 sends no focus, so fall
    // back to the goal it did send — which reproduces the old behaviour exactly.
    const focus = data.body_focus ?? focusFromProfile({ goal: data.goal })
    const plan = planForFocus(focus)
    const goal = plan.goal
    const pace_kg_per_week = plan.pace ?? data.pace_kg_per_week

    const macros = calculateTDEE({
      weightKg: data.current_weight_kg,
      heightCm: data.height_cm,
      age: data.age,
      sex: data.sex,
      activity_level: data.activity_level,
      goal,
      paceKgPerWeek: pace_kg_per_week,
    })

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: data.display_name,
        unit_system: 'metric',
        age: data.age,
        sex: data.sex,
        height_cm: data.height_cm,
        current_weight_kg: data.current_weight_kg,
        target_weight_kg: data.target_weight_kg,
        goal,
        activity_level: data.activity_level,
        // The picked weekly pace drives the macro maths above AND the projected
        // goal date every downstream screen shows — but it was never written
        // back here, so `/onboarding/plan` and the dashboard read the column
        // default (0.5) instead, and a user who chose 0.25 or 1.0 saw one goal
        // date in the wizard and a different one the moment they finished.
        pace_kg_per_week,
        daily_calorie_target: macros.daily_calorie_target,
        protein_g_target: macros.protein_g_target,
        carbs_g_target: macros.carbs_g_target,
        fat_g_target: macros.fat_g_target,
      })
      .eq('id', user.id)

    if (error) throw new Error(error.message)

    // Record the onboarding weight as the immutable start baseline (migration
    // 025). Best-effort + separate so a not-yet-applied column can't break
    // onboarding — it simply no-ops until 025 is live.
    // `body_focus`/`body_type` (migration 040) ride the same best-effort write
    // for the same reason: until the migration is applied by hand they simply
    // don't persist, and onboarding still completes on the derived `goal`.
    try {
      await supabase
        .from('profiles')
        .update({
          start_weight_kg: data.current_weight_kg,
          body_focus: focus,
          ...(data.body_type ? { body_type: data.body_type } : {}),
        })
        .eq('id', user.id)
    } catch { /* columns not present yet — ignore */ }

    captureServerEvent(user.id, 'onboarding_completed', { goal, body_focus: focus })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
