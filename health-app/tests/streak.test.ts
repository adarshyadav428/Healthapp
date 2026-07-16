import { describe, it, expect } from 'vitest'
import { calculateStreak } from '../lib/streak'
import type { FoodLog } from '../types/index'

const log = (iso: string) => ({ logged_at: iso }) as FoodLog

describe('calculateStreak (IST day semantics)', () => {
  it('counts a log made just after IST midnight, before UTC midnight (regression)', () => {
    // 2026-07-16T19:30:00Z = 2026-07-17 01:00 IST → IST "today" is Jul 17.
    // The old implementation truncated the reference to UTC midnight, computed
    // todayKey = Jul 16 IST, and returned 0 here.
    const reference = new Date('2026-07-16T19:30:00Z')
    const logs = [log('2026-07-16T19:00:00Z')] // 00:30 IST on Jul 17
    expect(calculateStreak(logs, reference)).toBe(1)
  })

  it('keeps yesterday-anchored streak alive when today has no log yet', () => {
    const reference = new Date('2026-07-16T10:00:00Z') // 15:30 IST Jul 16
    const logs = [
      log('2026-07-15T10:00:00Z'), // IST Jul 15
      log('2026-07-14T10:00:00Z'), // IST Jul 14
    ]
    expect(calculateStreak(logs, reference)).toBe(2)
  })

  it('counts consecutive IST days including today', () => {
    const reference = new Date('2026-07-16T10:00:00Z')
    const logs = [
      log('2026-07-16T04:00:00Z'), // IST Jul 16
      log('2026-07-15T20:00:00Z'), // 01:30 IST Jul 16 (same IST day, dedup)
      log('2026-07-14T19:00:00Z'), // 00:30 IST Jul 15
      log('2026-07-13T12:00:00Z'), // IST Jul 13 → gap at Jul 14
    ]
    // Jul 16 + Jul 15 = 2; Jul 14 missing breaks the streak
    expect(calculateStreak(logs, reference)).toBe(2)
  })

  it('returns 0 when there are no logs today or yesterday', () => {
    const reference = new Date('2026-07-16T10:00:00Z')
    expect(calculateStreak([log('2026-07-10T10:00:00Z')], reference)).toBe(0)
    expect(calculateStreak([], reference)).toBe(0)
  })

  it('a log made late at night IST (before IST midnight) counts for that IST day', () => {
    // 2026-07-16T18:00:00Z = 23:30 IST Jul 16 (still Jul 16 in IST)
    const reference = new Date('2026-07-16T18:00:00Z')
    const logs = [log('2026-07-16T17:00:00Z')] // 22:30 IST Jul 16
    expect(calculateStreak(logs, reference)).toBe(1)
  })
})
