import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase/server'
import { customFoodSchema } from '../../../../lib/validations'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = customFoodSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 400 })
    }

    const { data: food, error } = await supabase
      .from('foods')
      .insert({
        source: 'user',
        source_id: `user_${session.user.id}_${Date.now()}`,
        name: parsed.data.name,
        brand: parsed.data.brand ?? null,
        serving_size_g: parsed.data.serving_size_g,
        serving_description: parsed.data.serving_description,
        kcal_per_100g: parsed.data.kcal_per_100g,
        protein_g_per_100g: parsed.data.protein_g_per_100g,
        carbs_g_per_100g: parsed.data.carbs_g_per_100g,
        fat_g_per_100g: parsed.data.fat_g_per_100g,
        fiber_g_per_100g: parsed.data.fiber_g_per_100g ?? null,
      })
      .select('id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g')
      .single()

    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, food })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
