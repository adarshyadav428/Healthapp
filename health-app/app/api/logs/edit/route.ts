import { NextResponse } from 'next/server'
import { createServerClient } from '../../../../lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  id: z.string().uuid(),
  grams: z.number().positive(),
  servings: z.number().positive().default(1),
  meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  kcal: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
})

export async function PATCH(req: Request) {
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
    const parsed = schema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

    const { id, ...fields } = parsed.data
    const { error } = await supabase
      .from('food_logs')
      .update(fields)
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
