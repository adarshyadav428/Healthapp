import { describe, it, expect } from 'vitest'
import {
  DASHBOARD_MOMENTS,
  momentPriority,
  pickDashboardMoment,
  type DashboardMoment,
} from '../lib/dashboardMoments'

describe('pickDashboardMoment', () => {
  it('shows nothing when nothing is eligible', () => {
    expect(pickDashboardMoment([])).toBeNull()
  })

  it('shows the only eligible moment', () => {
    expect(pickDashboardMoment(['plateau'])).toBe('plateau')
  })

  it('never returns more than one — that is the whole point', () => {
    const result = pickDashboardMoment([...DASHBOARD_MOMENTS])
    expect(typeof result).toBe('string')
  })

  /**
   * The collision this exists for: at a streak of zero, a Pro user inside the
   * rescue window qualifies for both. "Repair it and it goes back to 12" and
   * "your best run was 12 days, start again" are each true and cannot both be
   * the next action.
   */
  it('offers the rescue rather than telling a Pro user to start over', () => {
    expect(pickDashboardMoment(['streak-restart', 'streak-rescue'])).toBe('streak-rescue')
    // Order of the input must not matter.
    expect(pickDashboardMoment(['streak-rescue', 'streak-restart'])).toBe('streak-rescue')
  })

  it('puts either streak moment ahead of the plateau', () => {
    expect(pickDashboardMoment(['plateau', 'streak-restart'])).toBe('streak-restart')
    expect(pickDashboardMoment(['plateau', 'streak-rescue'])).toBe('streak-rescue')
  })

  it('ignores an unknown value rather than ranking it first', () => {
    // momentPriority returns -1 for anything not in the list, which would beat
    // every real moment if it were ever passed through.
    const bogus = 'not-a-moment' as DashboardMoment
    expect(pickDashboardMoment([bogus, 'plateau'])).toBe('plateau')
  })
})

describe('the priority order is frozen', () => {
  it('ranks in declaration order', () => {
    expect(momentPriority('streak-rescue')).toBeLessThan(momentPriority('streak-restart'))
    expect(momentPriority('streak-restart')).toBeLessThan(momentPriority('plateau'))
  })
})

describe('the growth prompts, folded in 2026-08-25', () => {
  it('covers every attention card Home can render', () => {
    // If a new card is added to Home without a slot here, it will render
    // *alongside* the winner instead of competing with it — which is the exact
    // failure this module exists to prevent. Adding the card means adding it
    // to DASHBOARD_MOMENTS in the same pass.
    expect([...DASHBOARD_MOMENTS]).toEqual([
      'streak-rescue',
      'streak-restart',
      'plateau',
      'adaptive-target',
      'goal-projection',
      'weekly-recap',
      'verify-email',
      'notification-prime',
      'rate',
      'install',
    ])
  })

  it('never lets a pure ask outrank a broken streak', () => {
    // The wall this replaced could show "rate us" above "your 12-day streak
    // is repairable". Nothing the user gets nothing from may come first.
    for (const ask of ['rate', 'install', 'notification-prime'] as const) {
      expect(pickDashboardMoment([ask, 'streak-rescue'])).toBe('streak-rescue')
      expect(pickDashboardMoment([ask, 'streak-restart'])).toBe('streak-restart')
    }
  })

  it('puts the two pure asks last, install last of all', () => {
    const last = DASHBOARD_MOMENTS[DASHBOARD_MOMENTS.length - 1]
    expect(last).toBe('install')
    expect(momentPriority('rate')).toBeLessThan(momentPriority('install'))
    // Verifying an email unlocks free AI scans, so it gives something back and
    // outranks both asks.
    expect(momentPriority('verify-email')).toBeLessThan(momentPriority('rate'))
    expect(momentPriority('verify-email')).toBeLessThan(momentPriority('notification-prime'))
  })

  it('puts a correction to the target ahead of merely reporting a date', () => {
    // adaptive-target changes the number every other screen is measured
    // against; goal-projection is news.
    expect(pickDashboardMoment(['goal-projection', 'adaptive-target'])).toBe('adaptive-target')
  })

  it('still returns exactly one when literally everything is eligible', () => {
    const all = [...DASHBOARD_MOMENTS]
    expect(pickDashboardMoment(all)).toBe('streak-rescue')
    // and with the list reversed, to prove input order is irrelevant
    expect(pickDashboardMoment([...all].reverse())).toBe('streak-rescue')
  })

  it('gives every moment a distinct priority', () => {
    const priorities = DASHBOARD_MOMENTS.map(momentPriority)
    expect(new Set(priorities).size).toBe(DASHBOARD_MOMENTS.length)
    expect(priorities.every((p) => p >= 0)).toBe(true)
  })
})
