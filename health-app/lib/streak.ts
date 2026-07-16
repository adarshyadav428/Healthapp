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
