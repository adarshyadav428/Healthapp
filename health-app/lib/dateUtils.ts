/**
 * Returns the UTC start and end ISO timestamps for a given calendar date.
 * Defaults to today if no date is provided.
 */
export function getUtcDayRange(date: Date = new Date()): { start: string; end: string } {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  ).toISOString()
  const end = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)
  ).toISOString()
  return { start, end }
}

// Indian Standard Time = UTC + 5:30
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/**
 * Returns UTC ISO timestamps bounding the IST calendar day containing `date`.
 * Use this (not getUtcDayRange) for anything a user thinks of as "today" —
 * daily limits, "today" totals — since IST midnight is 5:30am UTC, not UTC midnight.
 */
export function getIstDayRange(date: Date = new Date()): { start: string; end: string } {
  const istShifted = new Date(date.getTime() + IST_OFFSET_MS)
  const y = istShifted.getUTCFullYear()
  const m = istShifted.getUTCMonth()
  const d = istShifted.getUTCDate()
  const start = new Date(Date.UTC(y, m, d) - IST_OFFSET_MS).toISOString()
  const end = new Date(Date.UTC(y, m, d + 1) - IST_OFFSET_MS).toISOString()
  return { start, end }
}
