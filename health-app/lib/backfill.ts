import type { SupabaseClient } from '@supabase/supabase-js'
import { istDateStr } from './dateUtils'
import { getIsPro, SubscriptionReadError } from './subscription'
import { LEGACY_LIMITS, limitsForSignupDate } from './freeTier'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Free users may log to today back through the last N IST days (today = day 1).
 * Sourced from lib/freeTier.ts — this export stays because other code imports it.
 */
export const FREE_BACKFILL_DAYS = LEGACY_LIMITS.historyDays

/**
 * True if `dateStr` (YYYY-MM-DD, IST) is inside the free backfill window.
 * `days` defaults to the legacy window; callers that know the account's signup
 * cohort pass `limitsForSignupDate(created_at).historyDays`.
 */
export function isWithinFreeLogWindow(
  dateStr: string,
  now: Date = new Date(),
  days: number = FREE_BACKFILL_DAYS
): boolean {
  const oldest = istDateStr(new Date(now.getTime() - (days - 1) * DAY_MS))
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

  // Past IST day — free users are limited to their cohort's history window.
  // profiles.created_at rides along in the same round trip as the sub read, so
  // resolving the cohort costs no extra wall time.
  let isPro: boolean
  let profile: { created_at?: string | null } | null
  try {
    ;[isPro, { data: profile }] = await Promise.all([
      getIsPro(supabase, userId),
      supabase.from('profiles').select('created_at').eq('id', userId).maybeSingle(),
    ])
  } catch (err) {
    // A read failure must block the backfill decision, not silently apply
    // the free-tier window to a Pro user (or the reverse) — neither is a
    // fact we can assert without the row. 2026-09-05 adversarial-audit F2.
    if (err instanceof SubscriptionReadError) {
      return { ok: false, status: 500, error: err.message }
    }
    throw err
  }
  const historyDays = limitsForSignupDate(profile?.created_at).historyDays
  if (!isPro && !isWithinFreeLogWindow(dateStr, now, historyDays)) {
    return {
      ok: false,
      status: 403,
      upgrade: true,
      error: `The free plan can log to the last ${historyDays} days. Upgrade to Pro to edit older days.`,
    }
  }

  return { ok: true, logged_at: resolveLoggedAt(dateStr, now) }
}
