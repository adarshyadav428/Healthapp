/**
 * The push budget.
 *
 * The risk this exists to manage is NOT annoyance — it's permission
 * revocation. An over-pushed Android user turns notifications off wholesale,
 * and the thing they kill is the streak-save nudge, which is almost certainly
 * the most effective retention mechanism currently shipping. Every notification
 * added after that one is spending its budget.
 *
 * Before this, nothing coordinated the senders: the daily reminder cron and the
 * Sunday recap cron both fired on a Sunday, and the monthly Wrapped would have
 * made three on the first Sunday of a month.
 *
 * Pure, so the priority rules are testable without a database.
 */

/** Every notification the app can send, most important first. */
export const PUSH_KINDS = [
  /** "Your 12-day streak ends tonight." The one that actually works. */
  'streak-save',
  /** "Your July is ready." Monthly, and the best advert Pro has. */
  'monthly-wrapped',
  /** Sunday recap. Useful, but it can wait a day. */
  'weekly-recap',
  /** Generic "still time to log today". The most replaceable. */
  'daily-reminder',
] as const

export type PushKind = (typeof PUSH_KINDS)[number]

/** Lower is more important. */
export function pushPriority(kind: PushKind): number {
  return PUSH_KINDS.indexOf(kind)
}

/**
 * At most one push a day, across every source.
 *
 * A hard cap rather than a per-kind allowance: users don't experience
 * notifications by category, they experience a count.
 */
export const MAX_PUSHES_PER_DAY = 1

/**
 * After this many consecutive unopened pushes, back off to the single most
 * important kind. Somebody ignoring five in a row is telling you something,
 * and the choice is to hear it or to lose the channel entirely.
 */
export const IGNORED_BEFORE_BACKOFF = 5

export type BudgetState = {
  /** Kinds already sent to this user today. */
  sentToday: readonly PushKind[]
  /** Consecutive pushes delivered but never opened. */
  consecutiveIgnored: number
}

/**
 * May this push go out?
 *
 * Returns a reason when refused so callers can log why a notification didn't
 * happen — silence with no explanation is how a broken push pipeline stays
 * broken for weeks.
 */
export function canSendPush(
  kind: PushKind,
  state: BudgetState
): { allowed: true } | { allowed: false; reason: 'daily_cap' | 'backoff' | 'outranked' } {
  if (state.consecutiveIgnored >= IGNORED_BEFORE_BACKOFF && kind !== PUSH_KINDS[0]) {
    return { allowed: false, reason: 'backoff' }
  }

  if (state.sentToday.length >= MAX_PUSHES_PER_DAY) {
    // The cap is spent — but a more important push may still displace a lesser
    // one that hasn't gone out yet in this same run. Once something of equal or
    // higher rank has been sent, this one is simply outranked.
    const best = Math.min(...state.sentToday.map(pushPriority))
    if (pushPriority(kind) < best) return { allowed: true }
    return { allowed: false, reason: pushPriority(kind) === best ? 'daily_cap' : 'outranked' }
  }

  return { allowed: true }
}

/** The single push worth sending from a set of candidates. */
export function pickPush(candidates: readonly PushKind[]): PushKind | null {
  if (candidates.length === 0) return null
  return [...candidates].sort((a, b) => pushPriority(a) - pushPriority(b))[0]
}
