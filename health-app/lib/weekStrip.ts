import { istDateStr, dateStrToUtcMidnight } from './dateUtils'

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export type WeekStripDay = {
  /** `YYYY-MM-DD` IST calendar date — the key /log?date= expects. */
  key: string
  letter: string
  dayNum: number
  isToday: boolean
  hasLog: boolean
}

/**
 * The last 7 IST calendar days, oldest first, for the home-screen strip.
 *
 * Every field is derived from the IST day — not UTC. IST midnight is 18:30 UTC
 * the previous day, so between 00:00 and 05:30 IST the UTC calendar date is
 * still yesterday: a UTC-derived strip labels the chips a day behind, marks
 * yesterday as "today", and links each chip to the wrong diary. The dots have
 * to be IST too, because `loggedDates` arrives as IST keys from the server
 * (app/dashboard/page.tsx) — matching UTC keys against them silently drops or
 * misplaces any log made in that 00:00–05:30 window.
 *
 * See lib/dateUtils.ts: there is exactly one definition of a day, and it is IST.
 */
export function buildWeekStrip(loggedDates: string[], now: Date = new Date()): WeekStripDay[] {
  const logged = new Set(loggedDates)
  const todayKey = istDateStr(now)

  return Array.from({ length: 7 }, (_, i) => {
    const key = istDateStr(new Date(now.getTime() - (6 - i) * 86_400_000))
    // Re-read the calendar fields off the IST key itself, so the letter and
    // number can never disagree with the key the chip links to.
    const d = dateStrToUtcMidnight(key)
    return {
      key,
      letter: DAY_LETTERS[d.getUTCDay()],
      dayNum: d.getUTCDate(),
      isToday: key === todayKey,
      hasLog: logged.has(key),
    }
  })
}
