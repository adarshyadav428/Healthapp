import { NextResponse } from 'next/server'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { z } from 'zod'
import { captureFoodLogged } from '../../../../lib/posthog/server'
import { getLogActivationContext, toLogMilestone } from '../../../../lib/logActivation'
import { resolveLoggedAtForRequest } from '../../../../lib/backfill'
import { streakEventsForLog } from '../../../../lib/streakEvents'
import { isFoodReferenceableBy } from '../../../../lib/foodOwnership'

const bulkLogSchema = z.object({
  items: z.array(z.object({
    food_id: z.string().uuid(),
    grams: z.number().positive().max(10000),
    meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  })).min(1).max(8),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

const round2 = (n: number) => Math.round(n * 100) / 100

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = user.id

    const json = await req.json()
    const parsed = bulkLogSchema.safeParse(json)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 })

    const foodIds = parsed.data.items.map(i => i.food_id)
    const { data: foods, error: foodsError } = await supabase
      .from('foods')
      .select('id, source, source_id, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g')
      .in('id', foodIds)

    if (foodsError) throw new Error(foodsError.message)

    // Same reasoning as /api/logs/add: `foods_select` RLS can't distinguish
    // "doesn't exist" from "exists but is someone else's private custom
    // food" (it's open to every signed-in user for the shared catalogue), so
    // an unreferenceable match is treated identically to a missing one below.
    const foodMap = new Map(
      (foods ?? [])
        .filter((f) => isFoodReferenceableBy(f, userId))
        .map(f => [f.id, f])
    )

    const when = await resolveLoggedAtForRequest(supabase, userId, parsed.data.date)
    if (!when.ok) return NextResponse.json({ error: when.error, upgrade: when.upgrade }, { status: when.status })
    const logged_at = when.logged_at

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

    const activation = await getLogActivationContext(supabase, user.id)

    const { error: insertError } = await supabase.from('food_logs').insert(rows)
    if (insertError) throw new Error(insertError.message)

    // Shared by the chat and camera flows — the client's x-log-method header
    // says which, so 'chat' is only the fallback.
    captureFoodLogged(userId, req, 'chat', {
      meal: 'mixed',
      items: rows.length,
      isFirstLog: activation.is_first_log,
      daysSinceSignup: activation.days_since_signup,
      streakEvents: streakEventsForLog(activation.logs_before, logged_at, activation.rescued_dates),
    })

    return NextResponse.json({ ok: true, logged: rows.length, milestone: toLogMilestone(activation, rows.length) })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
