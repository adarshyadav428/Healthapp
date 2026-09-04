// `getUtcDayRange` used to live here and was deleted on 2026-07-31.
//
// It was the second, competing definition of "a day": the UI grouped by UTC day
// while the business logic used IST, which shipped a wrong-data bug (the Trends
// day-diary showed the previous day's meals) and misfiled every log made between
// midnight and 05:30 IST. The call sites were migrated to the IST helpers below,
// after which it sat exported and unused — a loaded gun for the next person who
// wanted "the start of today". There is exactly one definition of a day now, and
// it is IST. Use getIstDayRange / istDateStr / istDaysAgoStart.

// Indian Standard Time = UTC + 5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/** The IANA zone every day boundary in this app is defined in. */
export const IST_TZ = 'Asia/Kolkata'

/**
 * Render an instant as text a user reads, in IST. The one sanctioned way.
 *
 * `toLocaleDateString` / `toLocaleTimeString` with no explicit `timeZone`
 * format in the **runtime's** zone: the device's in a client component, UTC on
 * a Vercel server. Both are wrong here, because every other part of this app
 * defines a day in IST — so a phone set to any other zone showed a weigh-in
 * made at 00:30 IST under the previous date, listed a 1am snack under
 * yesterday, and let Home's header name a day the diary below it disagreed
 * with. Nothing looks wrong in the source: the call reads as correct, which is
 * why three of these survived two audits before 2026-09-03 (P1-8/P1-9/P2-4).
 * `.eslintrc.json` now bans the raw calls outright, so the next one can't ship.
 *
 * Deliberately built on `Intl.DateTimeFormat` rather than the `Date` methods,
 * so this file needs no exemption from the rule it exists to satisfy — the ban
 * has zero holes to imitate.
 *
 * `locale` stays per-call because it decides field ORDER ("Sep 3" in en-US,
 * "3 Sep" in en-IN). That is a copy decision, not a timezone one, and forcing
 * one locale here would silently restyle every date in the app.
 */
export function formatIst(
  value: string | number | Date,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-IN'
): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: IST_TZ }).format(new Date(value))
}

/**
 * Returns UTC ISO timestamps bounding the IST calendar day containing `date`.
 * Use this (not getUtcDayRange) for anything a user thinks of as "today" —
 * daily limits, "today" totals — since IST midnight is 5:30am UTC, not UTC midnight.
 */
export function getIstDayRange(date: Date = new Date()): { start: string; end: string } {
  const istShifted = new Date(date.getTime() + IST_OFFSET_MS)
  const y = istShifted.getUTCFullYear()
  const m = istShifted.getUTCMonth()
  const d = istShifted.getUTCDate()
  const start = new Date(Date.UTC(y, m, d) - IST_OFFSET_MS).toISOString()
  const end = new Date(Date.UTC(y, m, d + 1) - IST_OFFSET_MS).toISOString()
  return { start, end }
}

/**
 * UTC ISO timestamp of the start of the IST calendar day `days - 1` days
 * before the one containing `date` — the oldest instant still inside a
 * "last N days" window of IST days (today counts as day 1). Used to clamp
 * free-tier history reads to the documented 7 days.
 */
export function istDaysAgoStart(days: number, date: Date = new Date()): string {
  const istShifted = new Date(date.getTime() + IST_OFFSET_MS)
  const y = istShifted.getUTCFullYear()
  const m = istShifted.getUTCMonth()
  const d = istShifted.getUTCDate()
  return new Date(Date.UTC(y, m, d - (days - 1)) - IST_OFFSET_MS).toISOString()
}

/**
 * Hour of the IST day (0–23) containing `date`. `Date.prototype.getHours()`
 * reads the **runtime's** hour, which is the device's in a client component —
 * so meal-of-day inference filed an NRI's 9pm dinner under whatever meal 9pm
 * was where they were standing, while the log itself landed on the IST day.
 * Shares the one offset constant rather than reaching for Intl, because a
 * number is wanted here and `hourCycle` differs between h23 and h24 by locale.
 */
export function istHour(date: Date = new Date()): number {
  return new Date(date.getTime() + IST_OFFSET_MS).getUTCHours()
}

/**
 * `YYYY-MM-DD` for the IST calendar date containing `date` (default: now).
 * This is the string the user thinks of as "the day" — use it for "today"
 * comparisons and date-param defaults instead of UTC calendar fields.
 */
export function istDateStr(date: Date = new Date()): string {
  const istShifted = new Date(date.getTime() + IST_OFFSET_MS)
  return [
    istShifted.getUTCFullYear(),
    String(istShifted.getUTCMonth() + 1).padStart(2, '0'),
    String(istShifted.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * The canonical `Date` for a `YYYY-MM-DD` string: UTC midnight of that date.
 * Pass it to getIstDayRange to get that IST day's UTC range — getIstDayRange's
 * +5:30 shift keeps 00:00 → 05:30 on the same calendar date, so the IST day it
 * extracts is exactly `dateStr`. (Do NOT use date-fns `parse`, which yields
 * *local*-midnight and drifts by the tz offset.)
 */
export function dateStrToUtcMidnight(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

/**
 * Clamp an untrusted `?start=` query param to the oldest instant a caller is
 * entitled to read. Returns the cutoff when `start` is absent or older than it,
 * `start` when it is newer, and **`null` when `start` is not a real timestamp** —
 * callers must answer 400 rather than hand the value to Postgres.
 *
 * It compares **parsed instants, not strings.** The string comparison this
 * replaces (`if (!start || start < cutoff) start = cutoff`) was only correct for
 * ISO-8601 input, and nothing validated that the input was ISO-8601. PostgreSQL
 * also accepts `epoch`, `today`, `now`, `yesterday` and `infinity` as timestamp
 * literals, and `'epoch' > '2026-…'` lexicographically ('e' sorts above '2'), so
 * `?start=epoch` sailed straight through the clamp, PostgREST forwarded it
 * verbatim as `logged_at=gte.epoch`, and Postgres read it as 1970-01-01 — handing
 * a free account its **entire** history through the app's own API. Found by the
 * 2026-09-03 audit (P1-1); it had been the only thing standing between the free
 * tier and unlimited history since the clamp was written.
 *
 * Parsing also fixes a quieter case the string compare got wrong in the other
 * direction: an ISO string carrying a large positive UTC offset is a *later*
 * instant than its digits suggest, so it could beat a cutoff it should not.
 */
export function clampHistoryStart(start: string | null | undefined, cutoff: string): string | null {
  if (!start) return cutoff
  const startMs = Date.parse(start)
  if (!Number.isFinite(startMs)) return null
  return startMs < Date.parse(cutoff) ? cutoff : start
}
