import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase/server'
import { z } from 'zod'
import { captureServerEvent } from '../../../../lib/posthog/server'

const bulkLogSchema = z.object({
  items: z.array(z.object({
    food_id: z.string().uuid(),
    grams: z.number().positive().max(10000),
    meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  })).min(1).max(8),
})

const round2 = (n: number) => Math.round(n * 100) / 100

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = user.id

    const json = await req.json()
    const parsed = bulkLogSchema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

    const foodIds = parsed.data.items.map(i => i.food_id)
    const { data: foods, error: foodsError } = await supabase
      .from('foods')
      .select('id, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g')
      .in('id', foodIds)

    if (foodsError) throw new Error(foodsError.message)

    const foodMap = new Map(foods?.map(f => [f.id, f]) ?? [])
    const logged_at = new Date().toISOString()

    const rows = parsed.data.items.map(item => {
      const food = foodMap.get(item.food_id)
      if (!food) throw new Error(`Food ${item.food_id} not found`)
      const factor = item.grams / 100
      return {
        user_id: userId,
        food_id: item.food_id,
        meal: item.meal,
        servings: 1,
        grams: item.grams,
        kcal: round2(food.kcal_per_100g * factor),
        protein_g: round2(food.protein_g_per_100g * factor),
        carbs_g: round2(food.carbs_g_per_100g * factor),
        fat_g: round2(food.fat_g_per_100g * factor),
        logged_at,
      }
    })

    const { error: insertError } = await supabase.from('food_logs').insert(rows)
    if (insertError) throw new Error(insertError.message)

    captureServerEvent(userId, 'meal_logged', { source: 'chat', items: rows.length })

    return NextResponse.json({ ok: true, logged: rows.length })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
