import { describe, it, expect } from 'vitest'
import { isWithinFreeLogWindow, resolveLoggedAt } from '../lib/backfill'
import { istDateStr } from '../lib/dateUtils'

// A fixed "now": 2026-07-17 08:00 UTC = 13:30 IST Jul 17.
const NOW = new Date('2026-07-17T08:00:00Z')

describe('isWithinFreeLogWindow', () => {
  it('allows today and the six prior IST days (7-day window)', () => {
    expect(isWithinFreeLogWindow('2026-07-17', NOW)).toBe(true) // today
    expect(isWithinFreeLogWindow('2026-07-11', NOW)).toBe(true) // day 7
  })

  it('rejects the day just outside the window and any future day', () => {
    expect(isWithinFreeLogWindow('2026-07-10', NOW)).toBe(false) // day 8
    expect(isWithinFreeLogWindow('2026-07-18', NOW)).toBe(false) // future
  })
})

describe('resolveLoggedAt', () => {
  it('uses the real instant for no date or today', () => {
    expect(resolveLoggedAt(undefined, NOW)).toBe(NOW.toISOString())
    expect(resolveLoggedAt(istDateStr(NOW), NOW)).toBe(NOW.toISOString())
  })

  it('pins a past IST day to noon IST (06:30 UTC), safely inside that IST day', () => {
    // noon IST Jul 15 = 06:30 UTC Jul 15
    expect(resolveLoggedAt('2026-07-15', NOW)).toBe('2026-07-15T06:30:00.000Z')
    // and its IST calendar date reads back as the same day
    expect(istDateStr(new Date(resolveLoggedAt('2026-07-15', NOW)))).toBe('2026-07-15')
  })
})
