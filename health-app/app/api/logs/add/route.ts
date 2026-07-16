import { NextResponse } from 'next/server'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { addFoodSchema } from '../../../../lib/validations'
import { captureServerEvent } from '../../../../lib/posthog/server'
import { getLogActivationContext } from '../../../../lib/logActivation'

const round2 = (n: number) => Math.round(n * 100) / 100

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const json = await req.json()
    const parsed = addFoodSchema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

    const { data: food, error: foodError } = await supabase
      .from('foods')
      .select('id, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g')
      .eq('id', parsed.data.food_id)
      .maybeSingle()

    if (foodError) throw new Error(foodError.message)
    if (!food) return NextResponse.json({ error: 'Food not found' }, { status: 404 })

    const factor = parsed.data.grams / 100
    const servings = parsed.data.servings
    const kcal = round2(food.kcal_per_100g * factor * servings)
    const protein = round2(food.protein_g_per_100g * factor * servings)
    const carbs = round2(food.carbs_g_per_100g * factor * servings)
    const fat = round2(food.fat_g_per_100g * factor * servings)

    const FOOD_SELECT = 'id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, common_portions'
    const logged_at = new Date().toISOString()

    const activation = await getLogActivationContext(supabase, user.id)

    const { data: inserted, error: insertError } = await supabase
      .from('food_logs')
      .insert({
        user_id: user.id,
        food_id: parsed.data.food_id,
        meal: parsed.data.meal,
        servings: parsed.data.servings,
        grams: parsed.data.grams,
        kcal,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
        logged_at,
      })
      .select(`id, meal, grams, servings, kcal, protein_g, carbs_g, fat_g, logged_at, food:foods(${FOOD_SELECT})`)
      .single()

    if (insertError) throw new Error(insertError.message)

    captureServerEvent(user.id, 'meal_logged', { source: 'add', meal: parsed.data.meal, kcal, ...activation })

    return NextResponse.json({ ok: true, row: inserted })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
