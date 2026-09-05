import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { scaleMacros } from '../../../../lib/nutrition'
import { captureFoodLogged, captureServerEvent } from '../../../../lib/posthog/server'
import { getLogActivationContext } from '../../../../lib/logActivation'
import { resolveLoggedAtForRequest } from '../../../../lib/backfill'
import { streakEventsForLog } from '../../../../lib/streakEvents'
import { isFoodReferenceableBy } from '../../../../lib/foodOwnership'

const schema = z.object({
  meal_id: z.string().uuid(),
  meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  // Optional backfill target — an IST calendar date (YYYY-MM-DD). Absent = today.
  //
  // This route had no date at all until 2026-09-03, so every combo took
  // `logged_at DEFAULT now()`. FoodLanding renders on any *editable* day (see
  // app/log/page.tsx — "so a missed day can be backfilled"), and its combos row
  // carried no isToday guard, so tapping a combo while viewing a past day filed
  // the whole meal on today, silently. Same shape as the camera bug that made
  // "every logging surface threads the date it is looking at" a hard rule.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 })

    // Verify the meal belongs to this user and get its items
    const { data: meal, error: mealErr } = await supabase
      .from('saved_meals')
      .select('id, saved_meal_items(food_id, grams, servings, food:foods(source, source_id, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g))')
      .eq('id', parsed.data.meal_id)
      .eq('user_id', user.id)
      .single()

    if (mealErr || !meal) return NextResponse.json({ error: 'Meal not found' }, { status: 404 })

    type MealItem = {
      food_id: string
      grams: number
      servings: number
      food: { source: string; source_id: string | null; kcal_per_100g: number; protein_g_per_100g: number; carbs_g_per_100g: number; fat_g_per_100g: number } | null
    }
    const rawItems = (meal.saved_meal_items as unknown as MealItem[]) ?? []
    // The combo itself is ownership-checked above, but /api/meals/saved is
    // what's meant to stop an item pointing at someone else's private custom
    // food from ever getting in — this is the second line of defence for a
    // combo saved before that check existed. `.food !== null` already
    // covered "the referenced food row was deleted"; a food that exists but
    // isn't this caller's to reference gets the same silent-drop treatment,
    // not a 500, since the caller can't fix someone else's food ownership.
    const items = rawItems.filter((item) => item.food !== null && isFoodReferenceableBy(item.food, user.id))
    if (items.length === 0) return NextResponse.json({ error: 'Meal has no items' }, { status: 400 })

    // Resolves and validates the target day, and enforces the free-tier
    // backfill window server-side — the same gate logs/add, add-bulk and
    // quick-add use, so accepting a date here cannot become a way around it.
    const when = await resolveLoggedAtForRequest(supabase, user.id, parsed.data.date)
    if (!when.ok) return NextResponse.json({ error: when.error, upgrade: when.upgrade }, { status: when.status })
    const logged_at = when.logged_at

    const logRows = items
      .filter((item) => item.food !== null)
      .map((item) => ({
        user_id: user.id,
        food_id: item.food_id,
        meal: parsed.data.meal_type,
        grams: item.grams,
        servings: item.servings,
        logged_at,
        // grams is per-serving; totals must include the servings multiplier
        // (previously omitted — a 2-serving saved item logged half its kcal)
        ...scaleMacros(item.food!, item.grams, item.servings ?? 1),
      }))

    const activation = await getLogActivationContext(supabase, user.id)

    const { error: insertErr } = await supabase.from('food_logs').insert(logRows)
    if (insertErr) throw new Error(insertErr.message)

    captureServerEvent(user.id, 'meal_template_logged', {
      meal: parsed.data.meal_type,
      items: logRows.length,
    })
    captureFoodLogged(user.id, req, 'meal_template', {
      meal: parsed.data.meal_type,
      items: logRows.length,
      isFirstLog: activation.is_first_log,
      daysSinceSignup: activation.days_since_signup,
      // The day the log actually landed on, not "now" — backfilling a missed
      // day changes what the streak did, and an analytics event describing a
      // different day than the row it came from is worse than no event.
      streakEvents: streakEventsForLog(activation.logs_before, logged_at, activation.rescued_dates),
    })

    return NextResponse.json({ ok: true, logged: logRows.length })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
