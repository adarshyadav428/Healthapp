import type { FoodLog } from '../types/index'

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
 */
export function calculateStreakState(
  logs: FoodLog[],
  referenceDate = new Date(),
  rescuedDates: readonly string[] = []
): StreakState {
  const dayKeyOf = (utcMs: number) => new Date(utcMs + IST_OFFSET_MS).toISOString().slice(0, 10)
  const logged = new Set<string>(logs.map((l) => toIstDateKey(l.logged_at)))
  const rescued = new Set<string>(rescuedDates)
  if (logged.size === 0) return { streak: 0, freezesBanked: 0, frozenDays: [], rescuedDays: [] }

  const refMs = referenceDate.getTime()
  const todayKey = dayKeyOf(refMs)

  // Walk forward from the oldest day we can see up to today.
  const oldestKey = [...logged].sort()[0]
  let cursor = Date.parse(`${oldestKey}T00:00:00Z`) - IST_OFFSET_MS

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
 */
export function findStreakRescue(
  logs: FoodLog[],
  referenceDate = new Date(),
  rescuedDates: readonly string[] = []
): { date: string; streakAfter: number } | null {
  const dayKeyOf = (utcMs: number) => new Date(utcMs + IST_OFFSET_MS).toISOString().slice(0, 10)
  const logged = new Set<string>(logs.map((l) => toIstDateKey(l.logged_at)))
  if (logged.size === 0) return null

  const already = new Set(rescuedDates)
  const current = calculateStreakState(logs, referenceDate, rescuedDates).streak
  const refMs = referenceDate.getTime()

  let best: { date: string; streakAfter: number } | null = null

  // Yesterday backwards. Today is never a break — the day isn't over.
  for (let i = 1; i <= RESCUE_WINDOW_DAYS; i++) {
    const key = dayKeyOf(refMs - i * DAY_MS)
    if (logged.has(key) || already.has(key)) continue

    const streakAfter = calculateStreakState(logs, referenceDate, [...rescuedDates, key]).streak
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
 * this is the honest "days you really logged" number.
 */
export function longestStreak(logs: FoodLog[]): number {
  const keys = [...new Set(logs.map((l) => toIstDateKey(l.logged_at)))].sort()
  if (keys.length === 0) return 0

  let best = 1
  let run = 1
  for (let i = 1; i < keys.length; i++) {
    const prev = Date.parse(`${keys[i - 1]}T00:00:00Z`)
    const curr = Date.parse(`${keys[i]}T00:00:00Z`)
    run = curr - prev === DAY_MS ? run + 1 : 1
    if (run > best) best = run
  }
  return best
}

export function calculateStreak(logs: FoodLog[], referenceDate = new Date()): number {
  // Derive "today" from the reference instant directly in IST. The previous
  // implementation truncated referenceDate to UTC midnight first, which made
  // todayKey the *UTC* calendar date — so between IST midnight and UTC
  // midnight (18:30–24:00 UTC) the streak was computed against yesterday's
  // IST day and a log made just after IST midnight didn't count.
  const dayKeyOf = (utcMs: number) => new Date(utcMs + IST_OFFSET_MS).toISOString().slice(0, 10)

  const set = new Set<string>(logs.map((l) => toIstDateKey(l.logged_at)))

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
