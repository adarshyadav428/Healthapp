import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient, getApiUser } from '../../../../lib/supabase/server'
import { getIstDayRange, dateStrToUtcMidnight, istDateStr } from '../../../../lib/dateUtils'
import { resolveLoggedAtForRequest } from '../../../../lib/backfill'
import { captureFoodLogged } from '../../../../lib/posthog/server'
import { getLogActivationContext, toLogMilestone } from '../../../../lib/logActivation'
import { streakEventsForLog } from '../../../../lib/streakEvents'
import { zodErrorMessage } from '../../../../lib/apiError'
import { filterUncopiedToDay, insertFoodLogCopies } from '../../../../lib/requestIdempotency'

export const runtime = 'nodejs'

/**
 * Copy one meal section from one IST day onto another.
 *
 * The client sends only *which* meal on *which* day — never the food rows. The
 * route re-reads them under the caller's RLS and re-inserts them wholesale, so
 * kcal/macros/grams/context are exactly what was logged and never anything the
 * client could have edited on the way through. Same reason copy-yesterday
 * spreads the stored row instead of recomputing.
 */
const copyMealSchema = z.object({
  /** IST day to copy FROM. */
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid source date'),
  meal: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  /** IST day to paste ONTO. Omitted means today. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date').optional(),
})

export async function POST(req: Request) {
  try {
    const supabase = createServerClient()
    const user = await getApiUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = user.id

    const parsed = copyMealSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: zodErrorMessage(parsed.error) }, { status: 400 })
    }
    const { from_date, meal, date } = parsed.data

    // An omitted `date` means today, so the same-day guard has to resolve it
    // before comparing — otherwise copying today's lunch and pasting it with no
    // date silently doubles the meal it came from.
    if (from_date === (date ?? istDateStr())) {
      return NextResponse.json({ error: 'That meal is already on this day.' }, { status: 400 })
    }

    // The target day decides both the timestamp we store and whether this user
    // is allowed to write to it at all (free accounts can only reach back their
    // cohort's history window). Resolve it before reading anything.
    const when = await resolveLoggedAtForRequest(supabase, userId, date)
    if (!when.ok) return NextResponse.json({ error: when.error, upgrade: when.upgrade }, { status: when.status })
    const logged_at = when.logged_at

    // Source day, as an IST calendar day — the same window the diary rendered.
    const { start, end } = getIstDayRange(dateStrToUtcMidnight(from_date))
    const { data: sourceLogs, error: fetchError } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('meal', meal)
      .gte('logged_at', start)
      .lt('logged_at', end)

    if (fetchError) throw new Error(fetchError.message)
    if (!sourceLogs || sourceLogs.length === 0) {
      // The copy is a reference, so the meal can be deleted between copy and
      // paste. Say so plainly rather than reporting a successful no-op.
      return NextResponse.json({ error: 'That meal is no longer there — it may have been edited or deleted.' }, { status: 404 })
    }

    // A rapid double-tap, a race between two near-simultaneous requests, or a
    // client retry after a timeout must not duplicate this same (meal,
    // target day) paste — see migration 048 and lib/requestIdempotency.ts.
    // Scoped to the target day (not a global "copied once, ever" rule): a
    // saved meal pasted onto two different days is two separate, legitimate
    // actions, and only a same-day repeat is a replay.
    // 2026-09-05 QA follow-up (P2).
    const filtered = await filterUncopiedToDay(supabase, userId, sourceLogs, logged_at)
    if (!filtered.ok) throw new Error(filtered.error)
    if (filtered.rows.length === 0) {
      return NextResponse.json({ ok: true, copied: 0, alreadyCopied: true })
    }

    const activation = await getLogActivationContext(supabase, userId)

    const result = await insertFoodLogCopies(supabase, filtered.rows, logged_at)
    if (!result.ok) throw new Error(result.error)
    if (result.copied === 0) {
      return NextResponse.json({ ok: true, copied: 0, alreadyCopied: true })
    }

    captureFoodLogged(userId, req, 'copy_meal', {
      meal,
      items: result.copied,
      isFirstLog: activation.is_first_log,
      daysSinceSignup: activation.days_since_signup,
      streakEvents: streakEventsForLog(activation.logs_before, logged_at, activation.rescued_dates),
    })

    return NextResponse.json({
      ok: true,
      copied: result.copied,
      milestone: toLogMilestone(activation, result.copied),
    })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
