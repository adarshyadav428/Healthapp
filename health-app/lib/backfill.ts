import type { SupabaseClient } from '@supabase/supabase-js'
import { istDateStr } from './dateUtils'
import { isProStatus } from './subscription'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Free users may log to today back through the last 7 IST days (today = day 1).
 *
 * This window governs the *data* only. A day filled in afterwards never extends
 * the streak — see `countsTowardStreak` in lib/streak.ts, which is what keeps
 * this from being a free, longer-reaching version of the Pro Streak Rescue.
 */
export const FREE_BACKFILL_DAYS = 7

/** True if `dateStr` (YYYY-MM-DD, IST) is inside the free backfill window. */
export function isWithinFreeLogWindow(dateStr: string, now: Date = new Date()): boolean {
  const oldest = istDateStr(new Date(now.getTime() - (FREE_BACKFILL_DAYS - 1) * DAY_MS))
  return dateStr >= oldest && dateStr <= istDateStr(now)
}

/**
 * The `logged_at` ISO timestamp to store for an optional backfill date.
 * No date, or today's date → the real current instant (preserves meal timing).
 * A past IST day → noon IST that day (unambiguously inside that IST calendar day).
 */
export function resolveLoggedAt(dateStr: string | undefined, now: Date = new Date()): string {
  if (!dateStr || dateStr === istDateStr(now)) return now.toISOString()
  return new Date(`${dateStr}T12:00:00+05:30`).toISOString()
}

type LoggedAtResult =
  | { ok: true; logged_at: string }
  | { ok: false; error: string; status: number; upgrade?: boolean }

/**
 * Server-side gate for a logging request that may target a past IST day.
 * Enforces: valid format, not in the future, and — for a past day — the free
 * 7-day window unless the user is Pro. Returns the `logged_at` to persist.
 */
export async function resolveLoggedAtForRequest(
  supabase: SupabaseClient,
  userId: string,
  dateStr: string | undefined,
  now: Date = new Date()
): Promise<LoggedAtResult> {
  if (!dateStr) return { ok: true, logged_at: now.toISOString() }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { ok: false, error: 'Invalid date', status: 400 }

  const today = istDateStr(now)
  if (dateStr > today) return { ok: false, error: 'Cannot log to a future date', status: 400 }
  if (dateStr === today) return { ok: true, logged_at: now.toISOString() }

  // Past IST day — free users are limited to the last 7 days.
  const { data: sub } = await supabase
    .from('subscriptions').select('status').eq('user_id', userId).maybeSingle()
  const isPro = isProStatus(sub?.status)
  if (!isPro && !isWithinFreeLogWindow(dateStr, now)) {
    return {
      ok: false,
      status: 403,
      upgrade: true,
      error: 'The free plan can log to the last 7 days. Upgrade to Pro to edit older days.',
    }
  }

  return { ok: true, logged_at: resolveLoggedAt(dateStr, now) }
}
