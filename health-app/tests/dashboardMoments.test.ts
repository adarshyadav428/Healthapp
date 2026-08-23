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
