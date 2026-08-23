/**
 * Diary date navigation helpers — shared by FoodHeader (chips + Today pill)
 * and SwipeDayNav (swipe gestures). The diary is keyed by `YYYY-MM-DD` in
 * **IST**, matching /log's ?date= parsing (app/log/page.tsx resolves the day
 * with istDateStr).
 *
 * This file used to define its own `todayUtcStr`, which made it the last
 * surviving second definition of "a day" — the exact thing dateUtils' header
 * warns about. Between 00:00 and 05:30 IST it disagreed with the page by one
 * day, so the Today pill rendered on the day that already was today and the
 * next-day chevron unlocked into a date the server then silently clamped
 * back. That window is the late-dinner logging slot. Use istDateStr.
 */
import { istDateStr } from './dateUtils'

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
export function logHref(dateStr: string, todayStr: string = istDateStr()): string {
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
