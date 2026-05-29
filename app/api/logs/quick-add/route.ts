import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '../../../../lib/supabase/server'

export const runtime = 'nodejs'

const schema = z.object({
  kcal:    z.number().int().min(1).max(5000),
  protein: z.number().min(0).max(500).optional().default(0),
  carbs:   z.number().min(0).max(1000).optional().default(0),
  fat:     z.number().min(0).max(500).optional().default(0),
  meal:    z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional().default('snack'),
})

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = session.user.id

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid data' }, { status: 400 })
    }
    const { kcal, protein, carbs, fat, meal } = parsed.data

    // Create a one-off food record (serving = 100g, so kcal_per_100g = entered kcal)
    const { data: food, error: foodError } = await supabase
      .from('foods')
      .insert({
        source:              'user',
        source_id:           `quickadd_${userId}_${Date.now()}`,
        name:                `Quick Add · ${kcal} kcal`,
        serving_size_g:      100,
        serving_description: '1 serving',
        kcal_per_100g:       kcal,
        protein_g_per_100g:  protein,
        carbs_g_per_100g:    carbs,
        fat_g_per_100g:      fat,
      })
      .select('id')
      .single()

    if (foodError || !food) throw new Error(foodError?.message ?? 'Food creation failed')

    // Log 1 × 100g serving
    const { error: logError } = await supabase.from('food_logs').insert({
      user_id:   userId,
      food_id:   food.id,
      meal,
      servings:  1,
      grams:     100,
      kcal,
      protein_g: protein,
      carbs_g:   carbs,
      fat_g:     fat,
      logged_at: new Date().toISOString(),
    })

    if (logError) throw new Error(logError.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
