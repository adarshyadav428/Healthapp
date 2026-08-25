/**
 * Which streak-lifecycle events a new log produces.
 *
 * The four names existed in the event catalog from day one and none of them
 * had an emit site, so the habit loop was invisible: you could see logs happen
 * but not whether they extended a streak, spent a freeze, or were a comeback.
 *
 * The subtle rule these pin is that a SECOND log on an already-logged day emits
 * nothing. Without that, `day_completed` would fire once per log and become a
 * duplicate of `food_logged` — measuring meals instead of days.
 */

import { describe, it, expect } from 'vitest'
import { streakEventsForLog, type LoggedAt } from '../lib/streakEvents'
import { BACKFILL_RULE_START_IST } from '../lib/streak'

/** Noon IST on the given IST date, expressed as the UTC instant we store. */
function at(istDate: string): string {
  return new Date(`${istDate}T12:00:00+05:30`).toISOString()
}

function logsFor(...istDates: string[]): LoggedAt[] {
  return istDates.map((d) => ({ logged_at: at(d) }))
}

const names = (events: { name: string }[]) => events.map((e) => e.name)

// "Now" for every case below: noon IST on the 10th.
const NOW = new Date(at('2026-08-10'))

describe('a day that was already logged produces nothing', () => {
  it('stays silent on the second log of the same day', () => {
    const before = logsFor('2026-08-08', '2026-08-09', '2026-08-10')
    expect(streakEventsForLog(before, at('2026-08-10'), [], NOW)).toEqual([])
  })
})

describe('extending a streak', () => {
  it('reports the day and the increment together', () => {
    const before = logsFor('2026-08-08', '2026-08-09')
    const events = streakEventsForLog(before, at('2026-08-10'), [], NOW)
    expect(names(events)).toEqual(['day_completed', 'streak_incremented'])
    expect(events[1].props.streak).toBe(3)
  })

  it('reports the very first log as a completed day', () => {
    const events = streakEventsForLog([], at('2026-08-10'), [], NOW)
    expect(names(events)).toContain('day_completed')
    expect(events[0].props.streak).toBe(1)
  })
})

describe('a banked freeze covering a gap', () => {
  it('reports streak_frozen when a freeze is spent', () => {
    // Seven consecutive days earns a freeze; the 9th is then missed and the
    // freeze covers it when the 10th is logged.
    const before = logsFor(
      '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04',
      '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08'
    )
    const events = streakEventsForLog(before, at('2026-08-10'), [], NOW)
    expect(names(events)).toContain('day_completed')
    expect(names(events)).toContain('streak_frozen')
  })
})

describe('coming back after a real break', () => {
  it('reports streak_restarted with the previous best, not streak_broken', () => {
    // A solid run in July, then nothing for weeks — too long for a freeze to
    // cover, so the streak genuinely reset.
    const before = logsFor(
      '2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05'
    )
    const events = streakEventsForLog(before, at('2026-08-10'), [], NOW)
    expect(names(events)).toContain('streak_restarted')
    const restarted = events.find((e) => e.name === 'streak_restarted')!
    expect(restarted.props.streak).toBe(1)
    expect(restarted.props.previous_best).toBe(5)
  })

  it('does not call a genuine first-ever log a restart', () => {
    const events = streakEventsForLog([], at('2026-08-10'), [], NOW)
    expect(names(events)).not.toContain('streak_restarted')
  })

  it('does not treat a single stray past log as a previous best', () => {
    // One log in July is not a streak, so returning is not a "restart".
    const events = streakEventsForLog(logsFor('2026-07-01'), at('2026-08-10'), [], NOW)
    expect(names(events)).not.toContain('streak_restarted')
  })
})

describe('a Pro rescue is honoured', () => {
  it('counts a rescued day so the reported streak is not understated', () => {
    // The 8th was missed and repaired with a rescue; logging the 9th and then
    // the 10th should continue the run through it.
    const before = logsFor('2026-08-06', '2026-08-07', '2026-08-09')
    const withRescue = streakEventsForLog(before, at('2026-08-10'), ['2026-08-08'], NOW)
    const without = streakEventsForLog(before, at('2026-08-10'), [], NOW)

    const streakOf = (events: { name: string; props: Record<string, number> }[]) =>
      events.find((e) => e.name === 'day_completed')!.props.streak

    expect(streakOf(withRescue)).toBeGreaterThan(streakOf(without))
  })
})

/**
 * A day filled in after the fact.
 *
 * `day_completed` still fires — the day genuinely gained data — but it carries
 * `backfilled: 1`, because the module's own contract is that true breaks are
 * derived downstream from gaps in `day_completed`. Without the flag, a gap
 * closed on a Sunday afternoon would look like a day the user showed up for and
 * quietly erase the break from the funnel.
 *
 * Dates derive from BACKFILL_RULE_START_IST so bumping that constant when a
 * release slips cannot grandfather away the cases meant to prove the rule.
 */
describe('backfilling a past day', () => {
  const RULE_MS = Date.parse(`${BACKFILL_RULE_START_IST}T00:00:00Z`)
  const day = (n: number) => new Date(RULE_MS + n * 86400000).toISOString().slice(0, 10)

  it('completes the day, flags it, and claims no increment', () => {
    const now = new Date(at(day(3)))
    const events = streakEventsForLog(logsFor(day(0), day(1)), at(day(2)), [], now)

    expect(names(events)).toEqual(['day_completed'])
    expect(events[0].props.backfilled).toBe(1)
  })

  it('leaves a same-day log unflagged and still incrementing', () => {
    const now = new Date(at(day(3)))
    const events = streakEventsForLog(logsFor(day(2)), at(day(3)), [], now)

    expect(events[0].props.backfilled).toBe(0)
    expect(names(events)).toContain('streak_incremented')
  })
})
