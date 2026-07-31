/**
 * When the daily reminder fires, per user.
 *
 * Until now there was one fixed evening nudge for everybody. This lets a user
 * pick their hour — but the honest version of that feature is constrained by
 * how often the endpoint can actually be invoked, and the constraint shapes
 * everything here, so it is written down rather than discovered later.
 *
 * The two invocations
 * -------------------
 * CATCH-ALL — the Vercel cron in vercel.json, once a day at 15:00 UTC (20:30
 *   IST). Hobby allows one trigger per day per cron and caps the project at
 *   two, so this cannot become hourly. It serves everyone who has not already
 *   had a push today, which is exactly the pre-036 behaviour and is why nobody
 *   can lose their reminder by touching this setting.
 *
 * HOURLY — .github/workflows/reminder-tick.yml, which pings the same route once
 *   an hour. It serves only users whose chosen hour is the current IST hour.
 *   This is what makes a chosen hour real.
 *
 * Double-sending is impossible regardless: every send goes through
 * sendBudgetedPush, and the budget is one push per day per user. The catch-all
 * and the hourly tick cannot both land.
 *
 * Why the picker stops at 20:00
 * -----------------------------
 * The catch-all fires at 20:30 IST. An hourly tick at 21:00, 22:00 or 23:00
 * arrives AFTER it, so the budget would have already spent the day's push and
 * the later slot would silently never fire. Offering hours we cannot honour
 * would be a setting that lies, so the list stops at 20:00. If the catch-all
 * ever moves later, extend REMINDER_HOURS to match — the two are coupled, and
 * tests/reminderSchedule.test.ts pins that coupling.
 *
 * Pure, so the schedule is testable without a scheduler.
 */

/** IST hour of the daily catch-all cron (15:00 UTC). Coupled to vercel.json. */
export const CATCH_ALL_IST_HOUR = 20

/**
 * Hours a user may choose. Starts at 06:00 — a "you haven't logged today" nudge
 * at 4am is an alarm clock, not a reminder — and ends at the catch-all hour.
 */
export const REMINDER_HOURS: readonly number[] = Array.from(
  { length: CATCH_ALL_IST_HOUR - 6 + 1 },
  (_, i) => 6 + i
)

/** Matches the pre-036 fixed evening nudge, so the default changes nothing. */
export const DEFAULT_REMINDER_HOUR = CATCH_ALL_IST_HOUR

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/** The IST hour containing `now`. The app's only definition of a clock. */
export function istHour(now: Date = new Date()): number {
  return new Date(now.getTime() + IST_OFFSET_MS).getUTCHours()
}

/** A stored value we can actually act on, or the default. */
export function normaliseReminderHour(hour: unknown): number {
  if (typeof hour !== 'number' || !Number.isInteger(hour)) return DEFAULT_REMINDER_HOUR
  if (hour < 0 || hour > 23) return DEFAULT_REMINDER_HOUR
  return hour
}

export type ReminderSlot = 'catch-all' | 'hourly'

/**
 * Should this user be sent the daily reminder on this invocation?
 *
 * The catch-all deliberately ignores the chosen hour. It is the floor: whatever
 * else happens, a user who has not logged and has not been pushed today still
 * gets one nudge, exactly as before this feature existed. The budget stops it
 * from doubling up with an hourly send that already went out.
 */
export function isReminderDue(args: {
  reminderHour: number
  nowIstHour: number
  slot: ReminderSlot
}): boolean {
  if (args.slot === 'catch-all') return true
  return normaliseReminderHour(args.reminderHour) === args.nowIstHour
}

/** "8:00 AM" / "8:00 PM" — the label the user picks from and reads back. */
export function formatReminderHour(hour: number): string {
  const h = normaliseReminderHour(hour)
  const suffix = h < 12 ? 'AM' : 'PM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}:00 ${suffix}`
}
