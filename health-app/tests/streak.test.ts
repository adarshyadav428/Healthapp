import { describe, it, expect } from 'vitest'
import { calculateStreak, calculateStreakState, MAX_FREEZES_BANKED } from '../lib/streak'
import type { FoodLog } from '../types/index'

const log = (iso: string) => ({ logged_at: iso }) as FoodLog

/** A log at noon IST on the given IST date. */
const onDay = (istDate: string) => log(`${istDate}T06:30:00Z`)
/** Reference instant: noon IST on the given IST date. */
const noonIst = (istDate: string) => new Date(`${istDate}T06:30:00Z`)

/** Consecutive IST days starting at `start`, `n` of them. */
function days(start: string, n: number): string[] {
  const out: string[] = []
  const base = Date.parse(`${start}T00:00:00Z`)
  for (let i = 0; i < n; i++) {
    out.push(new Date(base + i * 86400000).toISOString().slice(0, 10))
  }
  return out
}

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

describe('calculateStreakState (freezes)', () => {
  it('earns one freeze per 7 consecutive days', () => {
    const logs = days('2026-07-01', 7).map(onDay)
    const s = calculateStreakState(logs, noonIst('2026-07-07'))
    expect(s.streak).toBe(7)
    expect(s.freezesBanked).toBe(1)
  })

  it('does not earn a freeze before the 7th day', () => {
    const logs = days('2026-07-01', 6).map(onDay)
    expect(calculateStreakState(logs, noonIst('2026-07-06')).freezesBanked).toBe(0)
  })

  it('caps the bank so freezes never stockpile', () => {
    const logs = days('2026-07-01', 28).map(onDay) // would earn 4
    const s = calculateStreakState(logs, noonIst('2026-07-28'))
    expect(s.freezesBanked).toBe(MAX_FREEZES_BANKED)
  })

  it('spends a banked freeze to survive a missed day', () => {
    // 7 days earns a freeze, Jul 8 is missed, Jul 9 logged again.
    const logs = [...days('2026-07-01', 7), '2026-07-09'].map(onDay)
    const s = calculateStreakState(logs, noonIst('2026-07-09'))
    expect(s.frozenDays).toEqual(['2026-07-08'])
    expect(s.freezesBanked).toBe(0)
    // 7 logged + Jul 9 = 8. The frozen day kept it alive but added nothing.
    expect(s.streak).toBe(8)
  })

  it('breaks the streak when a day is missed with no freeze banked', () => {
    // Only 3 days — no freeze earned — then a gap.
    const logs = [...days('2026-07-01', 3), '2026-07-05'].map(onDay)
    const s = calculateStreakState(logs, noonIst('2026-07-05'))
    expect(s.streak).toBe(1)
    expect(s.frozenDays).toEqual([])
  })

  it('breaks once the banked freezes run out, so quitting still ends it', () => {
    // 28 days banks the max of 2, then 3 consecutive missed days.
    const logs = [...days('2026-07-01', 28), '2026-08-01'].map(onDay)
    const s = calculateStreakState(logs, noonIst('2026-08-01'))
    expect(s.streak).toBe(1)
    expect(s.freezesBanked).toBe(0)
  })

  it('never treats an unlogged today as missed', () => {
    // Logged through Jul 7, nothing yet on Jul 8 — the day is not over.
    const logs = days('2026-07-01', 7).map(onDay)
    const s = calculateStreakState(logs, noonIst('2026-07-08'))
    expect(s.streak).toBe(7)
    expect(s.freezesBanked).toBe(1)
    expect(s.frozenDays).toEqual([])
  })

  it('agrees with calculateStreak when no freeze is ever spent', () => {
    const logs = days('2026-07-01', 5).map(onDay)
    const ref = noonIst('2026-07-05')
    expect(calculateStreakState(logs, ref).streak).toBe(calculateStreak(logs, ref))
  })

  it('is empty for a user with no logs', () => {
    expect(calculateStreakState([], noonIst('2026-07-05'))).toEqual({
      streak: 0, freezesBanked: 0, frozenDays: [],
    })
  })
})
