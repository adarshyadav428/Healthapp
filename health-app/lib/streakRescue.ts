/**
 * The Streak Rescue allowance — pure rules, so the quota can be tested without
 * a database and the client and server can agree on what's left.
 *
 * One per calendar month, in IST. A calendar month rather than a rolling 30
 * days because "you've used this month's rescue" is a sentence a user can hold
 * in their head, and a rolling window turns every refusal into an argument
 * about exactly when the last one was.
 */

export const RESCUES_PER_MONTH = 1

/** IST month key (YYYY-MM) for a date. Streaks are counted in IST throughout. */
export function istMonthKey(date: Date): string {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 7)
}

/**
 * How many rescues remain this month, given when the previous ones were bought.
 *
 * Counts by `created_at` (when it was spent), never by `rescued_date` (which
 * day it repaired) — otherwise rescuing a day that fell just before a month
 * boundary would refund the allowance.
 */
export function rescuesRemaining(spentAt: readonly (string | Date)[], now = new Date()): number {
  const month = istMonthKey(now)
  const usedThisMonth = spentAt.filter((t) => istMonthKey(new Date(t)) === month).length
  return Math.max(0, RESCUES_PER_MONTH - usedThisMonth)
}
