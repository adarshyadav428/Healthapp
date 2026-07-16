// Per-user endpoint — never prerender (paramless GET looks static to Next otherwise)
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  items: z.array(z.object({
    food_id: z.string().uuid(),
    grams: z.number().positive(),
    servings: z.number().positive(),
  })).min(1),
})

const deleteSchema = z.object({ id: z.string().uuid() })

export async function GET() {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('saved_meals')
      .select('id, name, created_at, saved_meal_items(id, food_id, grams, servings, food:foods(id, name, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, serving_size_g, serving_description, source, source_id, brand, fiber_g_per_100g))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })

    const { data: meal, error: mealErr } = await supabase
      .from('saved_meals')
      .insert({ user_id: user.id, name: parsed.data.name })
      .select('id')
      .single()

    if (mealErr || !meal) throw new Error(mealErr?.message ?? 'Failed to create meal')

    const { error: itemsErr } = await supabase
      .from('saved_meal_items')
      .insert(parsed.data.items.map((item) => ({ meal_id: meal.id, ...item })))

    if (itemsErr) throw new Error(itemsErr.message)
    return NextResponse.json({ ok: true, id: meal.id })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = deleteSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const { error } = await supabase
      .from('saved_meals')
      .delete()
      .eq('id', parsed.data.id)
      .eq('user_id', user.id)

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
