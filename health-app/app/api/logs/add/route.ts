import { NextResponse } from 'next/server'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { addFoodSchema } from '../../../../lib/validations'
import { zodErrorMessage } from '../../../../lib/apiError'
import { captureFoodLogged } from '../../../../lib/posthog/server'
import { getLogActivationContext, toLogMilestone } from '../../../../lib/logActivation'
import { resolveLoggedAtForRequest } from '../../../../lib/backfill'
import { streakEventsForLog } from '../../../../lib/streakEvents'

const round2 = (n: number) => Math.round(n * 100) / 100

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const json = await req.json()
    const parsed = addFoodSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json(
        { error: zodErrorMessage(parsed.error, 'Check the amount and try again.') },
        { status: 400 }
      )
    }

    const { data: food, error: foodError } = await supabase
      .from('foods')
      .select('id, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g')
      .eq('id', parsed.data.food_id)
      .maybeSingle()

    if (foodError) throw new Error(foodError.message)
    if (!food) return NextResponse.json({ error: 'Food not found' }, { status: 404 })

    const factor = parsed.data.grams / 100
    const servings = parsed.data.servings
    const kcal = round2(food.kcal_per_100g * factor * servings)
    const protein = round2(food.protein_g_per_100g * factor * servings)
    const carbs = round2(food.carbs_g_per_100g * factor * servings)
    const fat = round2(food.fat_g_per_100g * factor * servings)

    const FOOD_SELECT = 'id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, common_portions'

    const when = await resolveLoggedAtForRequest(supabase, user.id, parsed.data.date)
    if (!when.ok) return NextResponse.json({ error: when.error, upgrade: when.upgrade }, { status: when.status })
    const logged_at = when.logged_at

    // An undo is not a new log — skip the activation read entirely rather than
    // computing a milestone we must then throw away.
    const isRestore = parsed.data.restore === true
    const activation = isRestore ? null : await getLogActivationContext(supabase, user.id)

    const { data: inserted, error: insertError } = await supabase
      .from('food_logs')
      .insert({
        user_id: user.id,
        food_id: parsed.data.food_id,
        meal: parsed.data.meal,
        servings: parsed.data.servings,
        grams: parsed.data.grams,
        kcal,
        protein_g: protein,
        carbs_g: carbs,
        fat_g: fat,
        logged_at,
        // Null unless the user picked one — see the schema note. Previously only
        // the edit route could set this, so no log ever carried a context and
        // the Trends insight built on it had no data to speak from.
        context: parsed.data.context ?? null,
      })
      .select(`id, meal, grams, servings, kcal, protein_g, carbs_g, fat_g, logged_at, food:foods(${FOOD_SELECT})`)
      .single()

    if (insertError) throw new Error(insertError.message)

    if (activation) {
      // `method` defaults to search: this route backs the search/add-food sheet
      // unless the client names a more specific path (re-log, quick add).
      captureFoodLogged(user.id, req, 'search', {
        meal: parsed.data.meal,
        kcal,
        isFirstLog: activation.is_first_log,
        daysSinceSignup: activation.days_since_signup,
        streakEvents: streakEventsForLog(activation.logs_before, logged_at, activation.rescued_dates),
      })
    }

    return NextResponse.json({
      ok: true,
      row: inserted,
      milestone: activation ? toLogMilestone(activation, 1) : null,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
