/**
 * Selection logic for the abandoned-anonymous-account sweep.
 *
 * Kept as a pure function, separate from the cron route, because this is the
 * one piece of the deferred-signup feature that DELETES user accounts. A bug
 * here is unrecoverable, so it needs to be exercised by tests rather than
 * inspected by eye inside a route handler.
 */

/** How long an anonymous account with nothing in it is kept before sweeping. */
export const ANON_RETENTION_DAYS = 30

export type AnonCandidate = {
  id: string
  /** ISO timestamp from profiles.created_at. */
  created_at: string
  /** NULL email is what marks a profile as never-converted. */
  email: string | null
  /** Number of food logs this user has written. */
  logCount: number
}

/**
 * Returns the ids safe to delete: anonymous (NULL email), older than the
 * retention window, and with no logged food.
 *
 * Every condition is a veto, and the log check is deliberately the strictest
 * of the three — an anonymous user who logged even one meal has data worth
 * more than the row they occupy, and gets kept regardless of age. Registered
 * users are never eligible under any circumstances.
 */
export function selectAbandonedAnonUsers(
  candidates: AnonCandidate[],
  now: Date = new Date()
): string[] {
  const cutoff = now.getTime() - ANON_RETENTION_DAYS * 86_400_000

  return candidates
    .filter((c) => {
      // Registered — never sweep, whatever else is true.
      if (c.email !== null) return false
      // Has real data — keep, whatever else is true.
      if (c.logCount > 0) return false

      const created = new Date(c.created_at).getTime()
      // An unparseable timestamp means we can't prove it's old enough. Keep it:
      // the cost of retaining a junk row is a row, the cost of the reverse is
      // someone's account.
      if (Number.isNaN(created)) return false

      return created < cutoff
    })
    .map((c) => c.id)
}
