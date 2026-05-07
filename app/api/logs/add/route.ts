import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase/server'
import { addFoodSchema } from '../../../../lib/validations'
import { getUtcDayRange } from '../../../../lib/dateUtils'

const round2 = (n: number) => Math.round(n * 100) / 100

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) throw new Error(sessionError.message)

    const user = session?.user ?? null
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const json = await req.json()
    const parsed = addFoodSchema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle()

    const isPro = !subError && (sub?.status === 'active' || sub?.status === 'trialing')

    if (!isPro) {
      const { start, end } = getUtcDayRange()
      const { count, error: countError } = await supabase
        .from('food_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('logged_at', start)
        .lt('logged_at', end)
      if (countError) throw new Error(countError.message)
      if ((count ?? 0) >= 5) {
        return NextResponse.json({ error: 'Free limit reached' }, { status: 402 })
      }
    }

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
        logged_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (insertError) throw new Error(insertError.message)

    return NextResponse.json({ ok: true, id: inserted?.id ?? null })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
