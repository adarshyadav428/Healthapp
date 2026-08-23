import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { captureFoodLogged } from '../../../../lib/posthog/server'
import { getLogActivationContext, toLogMilestone } from '../../../../lib/logActivation'
import { resolveLoggedAtForRequest } from '../../../../lib/backfill'
import { streakEventsForLog } from '../../../../lib/streakEvents'

export const runtime = 'nodejs'

const schema = z.object({
  kcal:    z.number().int().min(1).max(5000),
  protein: z.number().min(0).max(500).optional().default(0),
  carbs:   z.number().min(0).max(1000).optional().default(0),
  fat:     z.number().min(0).max(500).optional().default(0),
  meal:    z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional().default('snack'),
  date:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Undo of a just-deleted entry — see the note on addFoodSchema.restore.
  restore: z.boolean().optional(),
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

    const when = await resolveLoggedAtForRequest(supabase, userId, parsed.data.date)
    if (!when.ok) return NextResponse.json({ error: when.error, upgrade: when.upgrade }, { status: when.status })

    // An undo is not a new log — see the note on addFoodSchema.restore.
    const activation = parsed.data.restore === true
      ? null
      : await getLogActivationContext(supabase, user.id)

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
      logged_at: when.logged_at,
    })

    if (logError) throw new Error(logError.message)

    if (activation) {
      captureFoodLogged(userId, req, 'quick_add', {
        meal,
        kcal,
        isFirstLog: activation.is_first_log,
        daysSinceSignup: activation.days_since_signup,
        streakEvents: streakEventsForLog(activation.logs_before, when.logged_at, activation.rescued_dates),
      })
    }

    return NextResponse.json({
      ok: true,
      milestone: activation ? toLogMilestone(activation, 1) : null,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
