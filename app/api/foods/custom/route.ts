import { NextResponse } from 'next/server'
import { z } from 'zod'
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

const patchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200).optional(),
  brand: z.string().max(100).nullable().optional(),
  serving_size_g: z.number().positive().optional(),
  serving_description: z.string().max(100).optional(),
  kcal_per_100g: z.number().min(0).optional(),
  protein_g_per_100g: z.number().min(0).optional(),
  carbs_g_per_100g: z.number().min(0).optional(),
  fat_g_per_100g: z.number().min(0).optional(),
  fiber_g_per_100g: z.number().min(0).nullable().optional(),
})

export async function PATCH(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = patchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 400 })
    }

    const { id, ...fields } = parsed.data

    // Only allow editing user-created foods owned by this session
    const { data: existing } = await supabase
      .from('foods')
      .select('id, source, source_id')
      .eq('id', id)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'Food not found' }, { status: 404 })
    if (existing.source !== 'user' || !existing.source_id?.includes(session.user.id)) {
      return NextResponse.json({ error: 'Cannot edit this food' }, { status: 403 })
    }

    const { data: food, error } = await supabase
      .from('foods')
      .update(fields)
      .eq('id', id)
      .select('id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g')
      .single()

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, food })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await request.json()
    if (!id || typeof id !== 'string') return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const { data: existing } = await supabase
      .from('foods')
      .select('id, source, source_id')
      .eq('id', id)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'Food not found' }, { status: 404 })
    if (existing.source !== 'user' || !existing.source_id?.includes(session.user.id)) {
      return NextResponse.json({ error: 'Cannot delete this food' }, { status: 403 })
    }

    const { error } = await supabase.from('foods').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
