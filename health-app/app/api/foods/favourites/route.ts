// Per-user endpoint — never prerender (paramless GET looks static to Next otherwise)
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { isFoodReferenceableBy } from '../../../../lib/foodOwnership'

const FOOD_SELECT =
  'id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, common_portions'

const schema = z.object({ food_id: z.string().uuid() })

export async function GET() {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('food_favourites')
      .select(`id, food_id, food:foods(${FOOD_SELECT})`)
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
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid food_id' }, { status: 400 })

    // `foods_select` RLS is open to every signed-in user (the shared catalogue
    // has to be readable by everyone), so it can't stop this insert from
    // wiring up a favourite that points at someone else's private custom
    // food — this check is what does. Same 404 whether the id is unknown or
    // just not this caller's to reference, so a probe can't tell the two
    // apart. See lib/foodOwnership.ts.
    const { data: food, error: foodError } = await supabase
      .from('foods')
      .select('source, source_id')
      .eq('id', parsed.data.food_id)
      .maybeSingle()
    if (foodError) throw new Error(foodError.message)
    if (!food || !isFoodReferenceableBy(food, user.id)) {
      return NextResponse.json({ error: 'Food not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('food_favourites')
      .insert({ user_id: user.id, food_id: parsed.data.food_id })

    if (error && error.code !== '23505') throw new Error(error.message) // ignore duplicate
    return NextResponse.json({ ok: true })
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
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid food_id' }, { status: 400 })

    const { error } = await supabase
      .from('food_favourites')
      .delete()
      .eq('user_id', user.id)
      .eq('food_id', parsed.data.food_id)

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
