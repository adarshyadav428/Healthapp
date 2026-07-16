import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { captureServerEvent } from '../../../../lib/posthog/server'
import { getLogActivationContext } from '../../../../lib/logActivation'

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
    const user = await getApiUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = user.id

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid data' }, { status: 400 })
    }
    const { kcal, protein, carbs, fat, meal } = parsed.data

    const activation = await getLogActivationContext(supabase, user.id)

    const { error: logError } = await supabase.from('food_logs').insert({
      user_id:   userId,
      food_id:   null,
      meal,
      servings:  1,
      grams:     0,
      kcal,
      protein_g: protein,
      carbs_g:   carbs,
      fat_g:     fat,
      logged_at: new Date().toISOString(),
    })

    if (logError) throw new Error(logError.message)

    captureServerEvent(userId, 'meal_logged', { source: 'quick_add', meal, kcal, ...activation })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
