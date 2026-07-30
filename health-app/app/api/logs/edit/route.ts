import { NextResponse } from 'next/server'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { z } from 'zod'
import { MEAL_CONTEXTS } from '../../../../lib/mealContext'

const schema = z.object({
  id: z.string().uuid(),
  grams: z.number().positive(),
  servings: z.number().positive().default(1),
  meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  kcal: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  // Optional by design (migration 032). `null` is a real value here — it's how
  // a user clears a tag they set by mistake — so nullable rather than optional
  // alone, and `undefined` leaves the existing tag untouched.
  context: z.enum(MEAL_CONTEXTS).nullable().optional(),
})

export async function PATCH(req: Request) {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)

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
