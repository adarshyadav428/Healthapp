import type { FoodLog } from '../types/index'

export function calculateStreak(logs: FoodLog[], referenceDate = new Date()): number {
  const dayKey = (d: Date) => d.toISOString().slice(0, 10)

  const set = new Set<string>(logs.map((l) => l.logged_at.slice(0, 10)))

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
