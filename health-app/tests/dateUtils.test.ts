import { describe, it, expect } from 'vitest'
import { getIstDayRange, istDaysAgoStart, istDateStr, dateStrToUtcMidnight, clampHistoryStart, istHour } from '../lib/dateUtils'

describe('getIstDayRange', () => {
  it('brackets the IST calendar day (IST midnight = 18:30 UTC previous day)', () => {
    // 2026-07-16 10:00 UTC = 15:30 IST → IST day Jul 16
    const { start, end } = getIstDayRange(new Date('2026-07-16T10:00:00Z'))
    expect(start).toBe('2026-07-15T18:30:00.000Z')
    expect(end).toBe('2026-07-16T18:30:00.000Z')
  })

  it('rolls to the next IST day right after IST midnight, before UTC midnight', () => {
    // 2026-07-16 19:00 UTC = 00:30 IST Jul 17
    const { start, end } = getIstDayRange(new Date('2026-07-16T19:00:00Z'))
    expect(start).toBe('2026-07-16T18:30:00.000Z')
    expect(end).toBe('2026-07-17T18:30:00.000Z')
  })

  it('"yesterday" via now − 24h lands on the previous IST day (copy-yesterday fix)', () => {
    const now = new Date('2026-07-16T20:30:00Z') // 02:00 IST Jul 17
    const y = getIstDayRange(new Date(now.getTime() - 24 * 60 * 60 * 1000))
    // user's "yesterday" is IST Jul 16
    expect(y.start).toBe('2026-07-15T18:30:00.000Z')
    expect(y.end).toBe('2026-07-16T18:30:00.000Z')
  })
})

describe('istDaysAgoStart', () => {
  it('returns the start of the IST day 6 days back for a 7-day window (today = day 1)', () => {
    // 2026-07-16 10:00 UTC = 15:30 IST Jul 16 → window covers IST Jul 10–16
    expect(istDaysAgoStart(7, new Date('2026-07-16T10:00:00Z'))).toBe('2026-07-09T18:30:00.000Z')
  })

  it('anchors to the IST day, not the UTC day, just after IST midnight', () => {
    // 2026-07-16 19:00 UTC = 00:30 IST Jul 17 → window covers IST Jul 11–17
    expect(istDaysAgoStart(7, new Date('2026-07-16T19:00:00Z'))).toBe('2026-07-10T18:30:00.000Z')
  })
})

describe('istDateStr', () => {
  it('returns the IST calendar date, not the UTC one, for a post-IST-midnight instant', () => {
    // 2026-07-16 19:00 UTC = 00:30 IST Jul 17 — a late-night snack files under Jul 17
    expect(istDateStr(new Date('2026-07-16T19:00:00Z'))).toBe('2026-07-17')
  })

  it('still reads as the same IST day during the daytime overlap', () => {
    // 2026-07-16 10:00 UTC = 15:30 IST Jul 16
    expect(istDateStr(new Date('2026-07-16T10:00:00Z'))).toBe('2026-07-16')
  })
})

describe('dateStrToUtcMidnight + getIstDayRange (the /log + diary contract)', () => {
  it('a YYYY-MM-DD string resolves to exactly that IST calendar day', () => {
    // This is the P0-4 fix: tapping "Jul 16" must fetch IST-Jul-16's meals,
    // not UTC-Jul-16's (which would leak in the previous day's 00:00–05:30 IST).
    const { start, end } = getIstDayRange(dateStrToUtcMidnight('2026-07-16'))
    expect(start).toBe('2026-07-15T18:30:00.000Z')
    expect(end).toBe('2026-07-16T18:30:00.000Z')
  })

  it('round-trips: the IST day of a string maps back to the same string', () => {
    const { start } = getIstDayRange(dateStrToUtcMidnight('2026-01-01'))
    // start is IST-midnight of Jan 1 = 2025-12-31T18:30Z; its IST date is Jan 1
    expect(istDateStr(new Date(start))).toBe('2026-01-01')
  })
})

describe('clampHistoryStart (the free-tier history bound)', () => {
  const CUTOFF = '2026-08-29T18:30:00.000Z'

  it('returns the cutoff when no start is given', () => {
    expect(clampHistoryStart(null, CUTOFF)).toBe(CUTOFF)
    expect(clampHistoryStart(undefined, CUTOFF)).toBe(CUTOFF)
    expect(clampHistoryStart('', CUTOFF)).toBe(CUTOFF)
  })

  it('clamps a start older than the cutoff', () => {
    expect(clampHistoryStart('2020-01-01T00:00:00.000Z', CUTOFF)).toBe(CUTOFF)
  })

  it('does not widen a narrower request', () => {
    const later = '2026-09-01T00:00:00.000Z'
    expect(clampHistoryStart(later, CUTOFF)).toBe(later)
  })

  /**
   * P1-1. These are all valid PostgreSQL timestamp literals, and every one of
   * them sorts ABOVE an ISO cutoff beginning '2' — so the string comparison
   * this replaced let each through. `epoch` is the damaging one: Postgres reads
   * it as 1970-01-01, which is "give me everything".
   */
  it.each(['epoch', 'today', 'now', 'yesterday', 'infinity', 'allballs', 'garbage'])(
    'refuses the non-ISO literal %s rather than passing it through',
    (literal) => {
      expect(clampHistoryStart(literal, CUTOFF)).toBeNull()
      // The bug, stated as the property that failed: it used to survive.
      expect(literal > CUTOFF).toBe(true)
    }
  )

  it('compares instants, not digits — a large positive offset does not sneak past', () => {
    // Same wall-clock digits as the cutoff but +14:00, so a LATER instant than
    // it looks. String-compared it beats the cutoff; parsed, it is correctly
    // treated as later and kept.
    const offset = '2026-08-29T18:30:00.000+14:00'
    expect(Date.parse(offset)).toBeLessThan(Date.parse(CUTOFF))
    expect(clampHistoryStart(offset, CUTOFF)).toBe(CUTOFF)
  })
})

/**
 * `istHour` exists because `Date.prototype.getHours()` reads the runtime's
 * hour. Meal inference used it, so the meal a log was filed under came from the
 * device's clock while the day it was filed on came from IST — two clocks
 * deciding one row (audit 2026-09-03, P2-5).
 */
describe('istHour', () => {
  it('is the IST hour, not the runtime hour', () => {
    expect(istHour(new Date('2026-01-01T15:30:00Z'))).toBe(21) // 21:00 IST
    expect(istHour(new Date('2026-01-01T18:30:00Z'))).toBe(0)  // IST midnight
    expect(istHour(new Date('2026-01-01T19:30:00Z'))).toBe(1)  // next IST day
  })

  it('covers the half-hour offset, which a whole-hour zone would hide', () => {
    // 18:00 UTC is 23:30 IST. A +5:00 offset would say 23:00 too, so this is
    // the assertion that actually pins India rather than "some eastern zone".
    expect(istHour(new Date('2026-01-01T18:00:00Z'))).toBe(23)
    expect(istHour(new Date('2026-01-01T18:29:59Z'))).toBe(23)
    expect(istHour(new Date('2026-01-01T18:30:01Z'))).toBe(0)
  })

  it('stays inside 0–23 across a full day of instants', () => {
    for (let m = 0; m < 24 * 60; m += 7) {
      const h = istHour(new Date(Date.UTC(2026, 0, 1) + m * 60_000))
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(24)
    }
  })
})
