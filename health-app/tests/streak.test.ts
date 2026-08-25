import { describe, it, expect } from 'vitest'
import {
  BACKFILL_RULE_START_IST,
  calculateStreak,
  calculateStreakState,
  countsTowardStreak,
  findStreakRescue,
  longestStreak,
  MAX_FREEZES_BANKED,
} from '../lib/streak'
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

describe('longestStreak', () => {
  it('is 0 with no logs', () => {
    expect(longestStreak([])).toBe(0)
  })

  it('finds the best run, not the most recent one', () => {
    // A 5-day run in the past, a gap, then a 2-day run at the end.
    const logs = [...days('2026-07-01', 5), ...days('2026-07-20', 2)].map(onDay)
    expect(longestStreak(logs)).toBe(5)
  })

  it('counts a single logged day as 1', () => {
    expect(longestStreak([onDay('2026-07-01')])).toBe(1)
  })

  it('de-duplicates several logs on the same IST day', () => {
    expect(longestStreak([onDay('2026-07-01'), onDay('2026-07-01')])).toBe(1)
  })

  it('is unaffected by log ordering', () => {
    const forward = days('2026-07-01', 6).map(onDay)
    expect(longestStreak([...forward].reverse())).toBe(6)
  })

  it('does not apply freezes — it is the honest logged-days number', () => {
    // 7 days, a gap a freeze would have covered, then 1 more.
    const logs = [...days('2026-07-01', 7), '2026-07-09'].map(onDay)
    expect(longestStreak(logs)).toBe(7)
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
      streak: 0, freezesBanked: 0, frozenDays: [], rescuedDays: [],
    })
  })
})

describe('streak rescue', () => {
  it('bridges a rescued day without adding to the streak', () => {
    // Logged Mon–Wed, missed Thu, logged Fri. Rescuing Thu joins the two runs
    // into 4 logged days — the rescued day itself is not one of them.
    const logs = ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-10'].map(onDay)
    const ref = noonIst('2026-07-10')
    expect(calculateStreakState(logs, ref).streak).toBe(1)
    const rescued = calculateStreakState(logs, ref, ['2026-07-09'])
    expect(rescued.streak).toBe(4)
    expect(rescued.rescuedDays).toEqual(['2026-07-09'])
  })

  it('does not spend a banked freeze on a day already rescued', () => {
    // 7 logged days banks one freeze; the gap is then rescued, so the freeze
    // must survive — charging both would bill the user twice for one gap.
    const logs = [...days('2026-07-01', 7), '2026-07-09'].map(onDay)
    const ref = noonIst('2026-07-09')
    const rescued = calculateStreakState(logs, ref, ['2026-07-08'])
    expect(rescued.rescuedDays).toEqual(['2026-07-08'])
    expect(rescued.frozenDays).toEqual([])
    expect(rescued.freezesBanked).toBe(1)
  })

  it('ignores a rescue for a day that was logged anyway', () => {
    const logs = days('2026-07-06', 3).map(onDay)
    const ref = noonIst('2026-07-08')
    expect(calculateStreakState(logs, ref, ['2026-07-07']).streak).toBe(3)
    expect(calculateStreakState(logs, ref, ['2026-07-07']).rescuedDays).toEqual([])
  })

  it('drops rescued days when the streak breaks anyway', () => {
    // Rescuing one day can't bridge a two-day hole with no freezes banked.
    const logs = ['2026-07-01', '2026-07-05'].map(onDay)
    const ref = noonIst('2026-07-05')
    const state = calculateStreakState(logs, ref, ['2026-07-02'])
    expect(state.streak).toBe(1)
    expect(state.rescuedDays).toEqual([])
  })

  it('leaves the result replayable — same inputs, same answer', () => {
    const logs = ['2026-07-06', '2026-07-08'].map(onDay)
    const ref = noonIst('2026-07-08')
    expect(calculateStreakState(logs, ref, ['2026-07-07']))
      .toEqual(calculateStreakState(logs, ref, ['2026-07-07']))
  })
})

describe('findStreakRescue', () => {
  it('finds the break worth repairing and what the streak becomes', () => {
    const logs = ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-10'].map(onDay)
    expect(findStreakRescue(logs, noonIst('2026-07-10')))
      .toEqual({ date: '2026-07-09', streakAfter: 4 })
  })

  it('offers nothing when the streak is intact', () => {
    const logs = days('2026-07-06', 5).map(onDay)
    expect(findStreakRescue(logs, noonIst('2026-07-10'))).toBeNull()
  })

  it('offers nothing to a user with no logs at all', () => {
    expect(findStreakRescue([], noonIst('2026-07-10'))).toBeNull()
  })

  it('never offers today — the day is not over yet', () => {
    const logs = days('2026-07-06', 3).map(onDay)
    const found = findStreakRescue(logs, noonIst('2026-07-09'))
    expect(found?.date).not.toBe('2026-07-09')
  })

  it('will not reach further back than the rescue window', () => {
    // Gap on the 2nd, now the 10th — long past what one rescue may repair.
    const logs = ['2026-07-01', '2026-07-03', '2026-07-10'].map(onDay)
    expect(findStreakRescue(logs, noonIst('2026-07-10'))).toBeNull()
  })

  it('does not offer a day the user already rescued', () => {
    const logs = ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-10'].map(onDay)
    expect(findStreakRescue(logs, noonIst('2026-07-10'), ['2026-07-09'])).toBeNull()
  })

  it('offers nothing when a freeze already covered the gap', () => {
    // 7 days banks a freeze, which silently absorbs the miss — there is no
    // break left to sell a repair for.
    const logs = [...days('2026-07-01', 7), '2026-07-09'].map(onDay)
    expect(findStreakRescue(logs, noonIst('2026-07-09'))).toBeNull()
  })
})

/**
 * Backfill buys data, never streak credit.
 *
 * These dates are derived from BACKFILL_RULE_START_IST rather than written as
 * literals, so bumping the constant when the release slips can never quietly
 * grandfather the very cases that are supposed to prove the rule.
 */
describe('countsTowardStreak (a day logged vs. a day filled in)', () => {
  const RULE_MS = Date.parse(`${BACKFILL_RULE_START_IST}T00:00:00Z`)
  /** An IST date `n` days after the rule came into force. */
  const after = (n: number) => new Date(RULE_MS + n * 86400000).toISOString().slice(0, 10)
  /** An IST date `n` days before it. */
  const before = (n: number) => new Date(RULE_MS - n * 86400000).toISOString().slice(0, 10)

  /** Eaten on `ate`, written on `wrote` — both at noon IST. */
  const row = (ate: string, wrote: string) => ({
    logged_at: `${ate}T06:30:00Z`,
    created_at: `${wrote}T06:30:00Z`,
  })

  it('counts a log written the same IST day it is attributed to', () => {
    expect(countsTowardStreak(row(after(3), after(3)))).toBe(true)
  })

  it('does not count a day filled in afterwards', () => {
    expect(countsTowardStreak(row(after(3), after(4)))).toBe(false)
  })

  it('counts a row with no created_at — absence is not proof of backfill', () => {
    expect(countsTowardStreak({ logged_at: `${after(3)}T06:30:00Z` })).toBe(true)
    expect(countsTowardStreak({ logged_at: `${after(3)}T06:30:00Z`, created_at: null })).toBe(true)
  })

  it('counts a row whose created_at is unreadable, rather than throwing', () => {
    expect(countsTowardStreak({ logged_at: `${after(3)}T06:30:00Z`, created_at: 'nonsense' }))
      .toBe(true)
  })

  it('grandfathers a backfill written before the rule came into force', () => {
    // Unmistakably a backfill — eaten five days before it was written — but it
    // predates the rule, so nobody loses a streak they had already banked.
    expect(countsTowardStreak(row(before(6), before(1)))).toBe(true)
  })

  it('forgives clock skew across IST midnight', () => {
    // 23:59:50 IST, written ten seconds later — on the next IST day by the
    // clock, but the same act. Postgres stamps created_at a round trip after
    // the app computes logged_at, so this is a real shape, not a contrived one.
    const day = after(2)
    expect(countsTowardStreak({
      logged_at: `${day}T18:29:50Z`,
      created_at: `${day}T18:30:10Z`,
    })).toBe(true)
  })

  it('still catches a backfill ten minutes past midnight', () => {
    // Past the grace window: this is someone opening the app after midnight to
    // fill in yesterday, which is exactly what the rule is for.
    const day = after(2)
    expect(countsTowardStreak({
      logged_at: `${day}T18:29:50Z`,
      created_at: `${day}T18:40:00Z`,
    })).toBe(false)
  })

  describe('calculateStreakState', () => {
    it('does not let a backfilled day bridge a break', () => {
      // Logged on days 0, 1 and 3. Day 2 was missed and filled in on day 3.
      const logs = [
        row(after(0), after(0)),
        row(after(1), after(1)),
        row(after(2), after(3)), // the backfill
        row(after(3), after(3)),
      ]
      expect(calculateStreakState(logs, noonIst(after(3))).streak).toBe(1)
    })

    it('...where the same shape without created_at still counts — the live bug', () => {
      // Identical days, only the provenance missing. This is what production
      // does today, and why free 7-day backfill has been out-reaching the Pro
      // 3-day Streak Rescue that exists to sell exactly this repair.
      const logs = [after(0), after(1), after(2), after(3)]
        .map((d) => ({ logged_at: `${d}T06:30:00Z` }))
      expect(calculateStreakState(logs, noonIst(after(3))).streak).toBe(4)
    })

    it('does not bank a freeze on a backfilled day', () => {
      // Seven consecutive days would earn one freeze — but day 3 was filled in,
      // so the run is really 3 + 3 and nothing is banked.
      const withBackfill = [0, 1, 2, 3, 4, 5, 6].map((n) =>
        row(after(n), n === 3 ? after(4) : after(n))
      )
      const s = calculateStreakState(withBackfill, noonIst(after(6)))
      expect(s.streak).toBe(3)
      expect(s.freezesBanked).toBe(0)

      // The honest version of the same week does earn it.
      const honest = [0, 1, 2, 3, 4, 5, 6].map((n) => row(after(n), after(n)))
      const t = calculateStreakState(honest, noonIst(after(6)))
      expect(t.streak).toBe(7)
      expect(t.freezesBanked).toBe(1)
    })

    it('leaves a pre-cutoff streak exactly as it was', () => {
      // The grandfather clause, end to end: a run built out of backfills before
      // the rule shipped must not shrink the day it does.
      const logs = [6, 5, 4, 3, 2, 1].map((n) => row(before(n), before(1)))
      expect(calculateStreakState(logs, noonIst(before(1))).streak).toBe(6)
    })
  })

  describe('longestStreak', () => {
    it('excludes backfilled days from the best run', () => {
      // Five days, the middle one filled in later: the honest best run is 2.
      const logs = [0, 1, 2, 3, 4].map((n) => row(after(n), n === 2 ? after(4) : after(n)))
      expect(longestStreak(logs)).toBe(2)
    })
  })

  describe('findStreakRescue', () => {
    it('offers to repair a day the user backfilled', () => {
      // The streak really is broken on that day, so refusing the offer would
      // leave the user holding a break with no way to close it. Backfill sells
      // the data back; Rescue sells the streak back.
      const logs = [
        row(after(0), after(0)),
        row(after(1), after(1)),
        row(after(2), after(3)), // backfilled — breaks the streak
        row(after(3), after(3)),
      ]
      expect(findStreakRescue(logs, noonIst(after(3)))?.date).toBe(after(2))
    })
  })
})

describe('BACKFILL_RULE_START_IST', () => {
  it('is a well-formed IST date key', () => {
    // It is meant to be bumped by hand when a release slips, and a typo here
    // would silently disable the rule for every row ever written.
    expect(BACKFILL_RULE_START_IST).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Number.isFinite(Date.parse(`${BACKFILL_RULE_START_IST}T00:00:00Z`))).toBe(true)
  })
})
