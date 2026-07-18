import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { scaleMacros } from '../../../../lib/nutrition'
import { captureFoodLogged, captureServerEvent } from '../../../../lib/posthog/server'
import { getLogActivationContext } from '../../../../lib/logActivation'

const schema = z.object({
  meal_id: z.string().uuid(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
})

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })

    // Verify the meal belongs to this user and get its items
    const { data: meal, error: mealErr } = await supabase
      .from('saved_meals')
      .select('id, saved_meal_items(food_id, grams, servings, food:foods(kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g))')
      .eq('id', parsed.data.meal_id)
      .eq('user_id', user.id)
      .single()

    if (mealErr || !meal) return NextResponse.json({ error: 'Meal not found' }, { status: 404 })

    type MealItem = {
      food_id: string
      grams: number
      servings: number
      food: { kcal_per_100g: number; protein_g_per_100g: number; carbs_g_per_100g: number; fat_g_per_100g: number } | null
    }
    const items = (meal.saved_meal_items as unknown as MealItem[]) ?? []
    if (items.length === 0) return NextResponse.json({ error: 'Meal has no items' }, { status: 400 })

    const logRows = items
      .filter((item) => item.food !== null)
      .map((item) => ({
        user_id: user.id,
        food_id: item.food_id,
        meal: parsed.data.meal_type,
        grams: item.grams,
        servings: item.servings,
        // grams is per-serving; totals must include the servings multiplier
        // (previously omitted — a 2-serving saved item logged half its kcal)
        ...scaleMacros(item.food!, item.grams, item.servings ?? 1),
      }))

    const activation = await getLogActivationContext(supabase, user.id)

    const { error: insertErr } = await supabase.from('food_logs').insert(logRows)
    if (insertErr) throw new Error(insertErr.message)

    captureServerEvent(user.id, 'meal_template_logged', {
      meal: parsed.data.meal_type,
      items: logRows.length,
    })
    captureFoodLogged(user.id, req, 'meal_template', {
      meal: parsed.data.meal_type,
      items: logRows.length,
      isFirstLog: activation.is_first_log,
      daysSinceSignup: activation.days_since_signup,
    })

    return NextResponse.json({ ok: true, logged: logRows.length })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
