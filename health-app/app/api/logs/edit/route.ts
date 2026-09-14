import { NextResponse } from 'next/server'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { editFoodLogSchema } from '../../../../lib/validations'
import { zodErrorMessage } from '../../../../lib/apiError'
import { scaleMacros, type Per100Macros } from '../../../../lib/nutrition'

export async function PATCH(req: Request) {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const json = await req.json()
    const parsed = editFoodLogSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: zodErrorMessage(parsed.error, 'Check the amount and try again.') },
        { status: 400 }
      )
    }

    const { id, grams, servings, kcal, protein_g, carbs_g, fat_g, ...meta } = parsed.data

    // Recompute from the linked food's per-100g values whenever one exists —
    // see the note on editFoodLogSchema. `food:foods(...)` on a NULL food_id
    // resolves to null on its own, so this one read covers both cases: a
    // real food row overrides whatever the client sent for kcal/macros, and a
    // true quick-add note (no food_id) falls back to the client's own
    // figures, already bounded by the schema above.
    const { data: existing, error: fetchErr } = await supabase
      .from('food_logs')
      .select('id, food:foods(kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g)')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchErr) throw new Error(fetchErr.message)
    if (!existing) return NextResponse.json({ error: 'Entry not found' }, { status: 404 })

    const food = existing.food as unknown as Per100Macros | null
    const nutrition = food ? scaleMacros(food, grams, servings) : { kcal, protein_g, carbs_g, fat_g }

    const fields = { grams, servings, ...meta, ...nutrition }
    const { error } = await supabase
      .from('food_logs')
      .update(fields)
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, row: fields })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
