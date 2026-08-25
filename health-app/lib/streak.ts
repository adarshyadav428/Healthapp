// Indian Standard Time is UTC+5:30 (330 minutes ahead).
// Streak dates must be calculated in IST so that a user logging at
// 12:30 AM IST (= 7 PM UTC previous day) doesn't lose their streak.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

function toIstDateKey(isoString: string): string {
  const utcMs = new Date(isoString).getTime()
  return new Date(utcMs + IST_OFFSET_MS).toISOString().slice(0, 10)
}

const DAY_MS = 24 * 60 * 60 * 1000

/** A missed day is covered automatically once the user has banked a freeze. */
export const FREEZE_EARNED_EVERY = 7
/** Freezes never stockpile — at most two missed days can ever be covered. */
export const MAX_FREEZES_BANKED = 2

/** How far back a Pro user may reach to repair a break. */
export const RESCUE_WINDOW_DAYS = 3

/**
 * Everything the streak rules need from a log: when the food was eaten, and
 * when the row was written.
 *
 * Wider than `FoodLog` on purpose. Several callers do a narrow indexed read of
 * just these columns (getLogActivationContext, the rescue route, the reminder
 * cron) and every one of them reached the streak functions through an
 * `as unknown as FoodLog[]` cast. A cast is exactly the wrong tool once
 * `created_at` matters: it is the thing that would silently hide a missing
 * column and make every log look same-day.
 */
export type StreakLog = { logged_at: string; created_at?: string | null }

/**
 * The IST day the backfill rule comes into force.
 *
 * ## This must be on or after the day the change deploys.
 *
 * Rows created before it always count, so nobody wakes up to a streak that
 * shrank overnight for days they had already banked. The streak being derived
 * from history rather than stored is what makes that possible — and also what
 * makes the cutoff necessary, because without it the new rule would apply
 * retroactively to every row ever written.
 *
 * Shipping LATER than this date is harmless: logs created in between are
 * grandfathered and the rule simply starts biting late. Shipping EARLIER is the
 * outcome to avoid. If the release slips past it, bump it.
 */
export const BACKFILL_RULE_START_IST = '2026-09-01'

/**
 * `logged_at` is computed by the app; `created_at` is stamped by Postgres a
 * round trip later. A log written in the last moments of an IST day can land
 * with a `created_at` on the next one, and without slack that clock skew would
 * read as a backfill and quietly cost the user a streak day at midnight.
 */
const BACKFILL_GRACE_MS = 5 * 60 * 1000

/** Midnight IST that closes `istDayKey`, as a UTC instant. */
function endOfIstDayMs(istDayKey: string): number {
  return Date.parse(istDayKey + 'T00:00:00Z') - IST_OFFSET_MS + DAY_MS
}

/**
 * Whether a log may extend the streak — the one rule that separates "I logged
 * that day" from "I filled that day in afterwards".
 *
 * Backfilling buys data, never streak credit. Forget to log Friday, log it on
 * Saturday: the deficit maths, the trend, the day-chip dot and `daysLogged` all
 * improve, because those are claims about what you ate. The streak is a claim
 * about what you *did*, so Friday still counts as a day you did not log.
 *
 * This is a fix, not a new restriction. The streak has always been derived from
 * `logged_at` — the day the food is attributed to — so backfill has been
 * repairing streaks in production all along, for free, reaching four days
 * further back than the Pro Streak Rescue that exists to sell exactly that.
 *
 * Fails open in both directions that matter. An unreadable or absent
 * `created_at` counts, because the row cannot be *proven* to be a backfill and
 * a streak taken away on a guess is worse than one given away. Anything created
 * before `ruleStartIst` counts, because it predates the rule.
 */
export function countsTowardStreak(
  log: StreakLog,
  ruleStartIst: string = BACKFILL_RULE_START_IST
): boolean {
  const createdMs = log.created_at ? new Date(log.created_at).getTime() : NaN
  if (!Number.isFinite(createdMs)) return true

  const createdKey = new Date(createdMs + IST_OFFSET_MS).toISOString().slice(0, 10)
  if (createdKey < ruleStartIst) return true

  return createdMs <= endOfIstDayMs(toIstDateKey(log.logged_at)) + BACKFILL_GRACE_MS
}

/** The IST days a user genuinely logged on — backfilled rows excluded. */
function streakDayKeys(logs: readonly StreakLog[], ruleStartIst: string): Set<string> {
  const keys = new Set<string>()
  for (const l of logs) {
    if (countsTowardStreak(l, ruleStartIst)) keys.add(toIstDateKey(l.logged_at))
  }
  return keys
}

export type StreakState = {
  /** Current streak length in days. Frozen days keep it alive but don't add to it. */
  streak: number
  /** Freezes available right now (0…MAX_FREEZES_BANKED). */
  freezesBanked: number
  /** IST date keys (YYYY-MM-DD) that a freeze covered inside the current streak. */
  frozenDays: string[]
  /** IST date keys a Pro Streak Rescue covered inside the current streak. */
  rescuedDays: string[]
}

/**
 * Streak with freezes, derived entirely from log history — no stored state, so
 * there is nothing to migrate, drift, or repair. Replaying the same logs always
 * yields the same answer.
 *
 * Rules (all free, never paywalled):
 *  - Every FREEZE_EARNED_EVERY consecutive logged days earns one freeze.
 *  - At most MAX_FREEZES_BANKED are held, so a long absence still breaks the
 *    streak; freezes forgive a slip, they don't forgive quitting.
 *  - A missed day spends a freeze automatically if one is banked. The streak
 *    survives but does NOT grow — a frozen day was not a logged day.
 *  - Today is never counted as missed: the day isn't over, so an unlogged today
 *    neither breaks the streak nor spends a freeze.
 *  - A day filled in afterwards was not logged that day — see countsTowardStreak.
 *
 * Only the days present in `logs` bound the walk, so callers passing a rolling
 * window (the dashboard passes ~60 days) reconstruct any streak that fits it.
 *
 * `rescuedDates` (IST date keys) are Pro Streak Rescues — days the user paid to
 * bridge after the fact. They're passed IN rather than read from a table so
 * this function stays pure and replayable: the whole point of deriving the
 * streak from history is that there's nothing to migrate, drift or repair, and
 * a DB read in here would throw that away. A rescued day behaves like a frozen
 * one (keeps the streak alive, doesn't add to it) but costs no banked freeze —
 * the user already paid for it.
 *
 * `ruleStartIst` is an argument for the same reason, and not a clock read: a
 * pure function that consults the current date is not replayable.
 */
export function calculateStreakState(
  logs: readonly StreakLog[],
  referenceDate = new Date(),
  rescuedDates: readonly string[] = [],
  ruleStartIst: string = BACKFILL_RULE_START_IST
): StreakState {
  const dayKeyOf = (utcMs: number) => new Date(utcMs + IST_OFFSET_MS).toISOString().slice(0, 10)
  const logged = streakDayKeys(logs, ruleStartIst)
  const rescued = new Set<string>(rescuedDates)
  if (logged.size === 0) return { streak: 0, freezesBanked: 0, frozenDays: [], rescuedDays: [] }

  const refMs = referenceDate.getTime()
  const todayKey = dayKeyOf(refMs)

  // Walk forward from the oldest day we can see up to today.
  const oldestKey = [...logged].sort()[0]
  let cursor = Date.parse(oldestKey + 'T00:00:00Z') - IST_OFFSET_MS

  let streak = 0
  let banked = 0
  let frozenDays: string[] = []
  let rescuedDays: string[] = []

  while (dayKeyOf(cursor) <= todayKey) {
    const key = dayKeyOf(cursor)

    if (logged.has(key)) {
      streak += 1
      if (streak % FREEZE_EARNED_EVERY === 0 && banked < MAX_FREEZES_BANKED) banked += 1
    } else if (key === todayKey) {
      // Today is still in progress — leave the streak pending, spend nothing.
    } else if (rescued.has(key)) {
      // Checked BEFORE the freeze: spending a banked freeze on a day the user
      // has already paid to rescue would charge them twice for one gap.
      rescuedDays.push(key)
    } else if (banked > 0) {
      banked -= 1
      frozenDays.push(key)
    } else {
      streak = 0
      banked = 0
      frozenDays = []
      rescuedDays = []
    }

    cursor += DAY_MS
  }

  return { streak, freezesBanked: banked, frozenDays, rescuedDays }
}

/**
 * The break a Streak Rescue would repair, and what the streak becomes if it is.
 *
 * Works by replaying `calculateStreakState` with each candidate day added, so
 * the rescue can never disagree with the rules that produce the streak itself.
 * Returns null when no single rescue would actually help — there's no break in
 * reach, the gap is wider than one purchase can bridge, or a freeze already
 * covered it.
 *
 * A backfilled day is therefore still rescuable, and deliberately so: the
 * streak really is broken on it, and refusing the offer would leave the user
 * holding a break with no way to close it. Backfill sells the data back; Rescue
 * sells the streak back. Those were the same purchase until countsTowardStreak
 * separated them.
 */
export function findStreakRescue(
  logs: readonly StreakLog[],
  referenceDate = new Date(),
  rescuedDates: readonly string[] = [],
  ruleStartIst: string = BACKFILL_RULE_START_IST
): { date: string; streakAfter: number } | null {
  const dayKeyOf = (utcMs: number) => new Date(utcMs + IST_OFFSET_MS).toISOString().slice(0, 10)
  const logged = streakDayKeys(logs, ruleStartIst)
  if (logged.size === 0) return null

  const already = new Set(rescuedDates)
  const current = calculateStreakState(logs, referenceDate, rescuedDates, ruleStartIst).streak
  const refMs = referenceDate.getTime()

  let best: { date: string; streakAfter: number } | null = null

  // Yesterday backwards. Today is never a break — the day isn't over.
  for (let i = 1; i <= RESCUE_WINDOW_DAYS; i++) {
    const key = dayKeyOf(refMs - i * DAY_MS)
    if (logged.has(key) || already.has(key)) continue

    const streakAfter = calculateStreakState(
      logs,
      referenceDate,
      [...rescuedDates, key],
      ruleStartIst
    ).streak
    if (streakAfter > current && (!best || streakAfter > best.streakAfter)) {
      best = { date: key, streakAfter }
    }
  }

  return best
}

/**
 * The longest run of consecutive logged IST days anywhere in `logs`.
 *
 * Badges read from this, not the current streak: a badge that vanishes because
 * you missed one Tuesday turns the shelf into a source of dread rather than a
 * record of what you actually did. Freezes are deliberately NOT applied here —
 * this is the honest "days you really logged" number, and backfilled days are
 * excluded for the same reason. A 30-day `consistent` badge earned by filling
 * in a month on one Sunday afternoon is the opposite of what the shelf is for.
 */
export function longestStreak(
  logs: readonly StreakLog[],
  ruleStartIst: string = BACKFILL_RULE_START_IST
): number {
  const keys = [...streakDayKeys(logs, ruleStartIst)].sort()
  if (keys.length === 0) return 0

  let best = 1
  let run = 1
  for (let i = 1; i < keys.length; i++) {
    const prev = Date.parse(keys[i - 1] + 'T00:00:00Z')
    const curr = Date.parse(keys[i] + 'T00:00:00Z')
    run = curr - prev === DAY_MS ? run + 1 : 1
    if (run > best) best = run
  }
  return best
}

/**
 * The streak without freezes, rescues, or any of the rest.
 *
 * Retained because `calculateStreakState` is tested against it, and an oracle
 * that shares its subject's machinery proves nothing. It does apply
 * countsTowardStreak, so the two still agree on the one rule they both obey.
 */
export function calculateStreak(
  logs: readonly StreakLog[],
  referenceDate = new Date(),
  ruleStartIst: string = BACKFILL_RULE_START_IST
): number {
  // Derive "today" from the reference instant directly in IST. The previous
  // implementation truncated referenceDate to UTC midnight first, which made
  // todayKey the *UTC* calendar date — so between IST midnight and UTC
  // midnight (18:30–24:00 UTC) the streak was computed against yesterday's
  // IST day and a log made just after IST midnight didn't count.
  const dayKeyOf = (utcMs: number) => new Date(utcMs + IST_OFFSET_MS).toISOString().slice(0, 10)

  const set = streakDayKeys(logs, ruleStartIst)

  let streak = 0
  const refMs = referenceDate.getTime()
  const todayKey = dayKeyOf(refMs)
  const startOffset = set.has(todayKey) ? 0 : 1

  // Stepping in fixed 24h increments is safe: IST has no DST.
  for (let i = startOffset; ; i++) {
    const key = dayKeyOf(refMs - i * DAY_MS)
    if (set.has(key)) streak += 1
    else break
  }

  return streak
}
