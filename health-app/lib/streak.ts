import type { FoodLog } from '../types/index'

// Indian Standard Time is UTC+5:30 (330 minutes ahead).
// Streak dates must be calculated in IST so that a user logging at
// 12:30 AM IST (= 7 PM UTC previous day) doesn't lose their streak.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

function toIstDateKey(isoString: string): string {
  const utcMs = new Date(isoString).getTime()
  return new Date(utcMs + IST_OFFSET_MS).toISOString().slice(0, 10)
}

export function calculateStreak(logs: FoodLog[], referenceDate = new Date()): number {
  const dayKey = (d: Date) => {
    const istMs = d.getTime() + IST_OFFSET_MS
    return new Date(istMs).toISOString().slice(0, 10)
  }

  const set = new Set<string>(logs.map((l) => toIstDateKey(l.logged_at)))

  let streak = 0
  const today = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()))
  const todayKey = dayKey(today)
  const startOffset = set.has(todayKey) ? 0 : 1

  for (let i = startOffset; ; i++) {
    const d = new Date(today)
    d.setUTCDate(today.getUTCDate() - i)
    const key = dayKey(d)
    if (set.has(key)) streak += 1
    else break
  }

  return streak
}
