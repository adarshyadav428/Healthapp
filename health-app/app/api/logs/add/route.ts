import { NextResponse } from 'next/server'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { addFoodSchema } from '../../../../lib/validations'
import { zodErrorMessage } from '../../../../lib/apiError'
import { isFoodReferenceableBy } from '../../../../lib/foodOwnership'
import { captureFoodLogged } from '../../../../lib/posthog/server'
import { getLogActivationContext, toLogMilestone } from '../../../../lib/logActivation'
import { resolveLoggedAtForRequest } from '../../../../lib/backfill'
import { streakEventsForLog } from '../../../../lib/streakEvents'
import { insertIdempotent } from '../../../../lib/requestIdempotency'

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
      .select('id, source, source_id, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g')
      .eq('id', parsed.data.food_id)
      .maybeSingle()

    if (foodError) throw new Error(foodError.message)
    // Same 404 for "doesn't exist" and "exists but is someone else's private
    // custom food" — `foods_select` RLS can't tell those apart (it's open to
    // every signed-in user by design, for the shared catalogue), so this is
    // the only check standing between reading a row and logging against it.
    // A distinct "forbidden" response would confirm to the caller that a
    // food_id they don't own is real. See lib/foodOwnership.ts.
    if (!food || !isFoodReferenceableBy(food, user.id)) {
      return NextResponse.json({ error: 'Food not found' }, { status: 404 })
    }

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

    // A rapid double-tap, a same-tick race between two requests, or a client
    // retry after a timeout must not create a duplicate log — see migration
    // 049 and lib/requestIdempotency.ts. client_request_id is generated once
    // per modal-open, so a genuinely separate log (the user reopens the
    // form) always gets a fresh key and still inserts. Confirmed exploitable
    // before this: two genuinely simultaneous requests both persisted.
    // 2026-09-13 remediation, R8.
    const result = await insertIdempotent<{ id: string; meal: string; grams: number; servings: number; kcal: number; protein_g: number; carbs_g: number; fat_g: number; logged_at: string; food: Record<string, unknown> }>(
      supabase,
      'food_logs',
      user.id,
      {
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
        client_request_id: parsed.data.client_request_id ?? null,
      },
      `id, meal, grams, servings, kcal, protein_g, carbs_g, fat_g, logged_at, food:foods(${FOOD_SELECT})`
    )
    if (!result.ok) throw new Error(result.error)
    const inserted = result.data

    // A replay of an already-persisted submission must not double-count
    // analytics or fire the milestone/first-log celebration a second time.
    if (activation && !result.alreadyExisted) {
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
      milestone: activation && !result.alreadyExisted ? toLogMilestone(activation, 1) : null,
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
