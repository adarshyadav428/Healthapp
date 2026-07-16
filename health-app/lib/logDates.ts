/**
 * Diary date navigation helpers — shared by FoodHeader (chips + Today pill)
 * and SwipeDayNav (swipe gestures). The diary is keyed by UTC date strings
 * (YYYY-MM-DD), matching /log's ?date= parsing.
 */

export function todayUtcStr(now: Date = new Date()): string {
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    String(now.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

export function shiftDateStr(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day + days))
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

/** The /log href for a date — today gets the canonical bare URL. */
export function logHref(dateStr: string, todayStr: string = todayUtcStr()): string {
  return dateStr === todayStr ? '/log' : `/log?date=${dateStr}`
}

// Swipe thresholds: long enough to be deliberate, and clearly more
// horizontal than vertical so page scrolling never triggers navigation.
const SWIPE_MIN_X = 64
const SWIPE_X_DOMINANCE = 2

/**
 * Classify a completed touch gesture. Swiping left (content moves left)
 * advances to the NEXT day; swiping right goes back one day.
 */
export function decideSwipe(dx: number, dy: number): 'prev' | 'next' | null {
  if (Math.abs(dx) < SWIPE_MIN_X) return null
  if (Math.abs(dx) < SWIPE_X_DOMINANCE * Math.abs(dy)) return null
  return dx < 0 ? 'next' : 'prev'
}
