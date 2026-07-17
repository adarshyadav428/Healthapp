import { describe, it, expect } from 'vitest'
import { getLogMilestoneAction, LOG_PAYWALL_THRESHOLD, nextUnseenStreakMilestone } from '../lib/logMilestones'

const seenNone = { celebrationSeen: false, paywallSeen: false }

describe('getLogMilestoneAction', () => {
  it('fires the celebration on the first-ever log', () => {
    expect(
      getLogMilestoneAction({ isFirstLog: true, totalLogs: 1, isPro: false }, seenNone)
    ).toBe('first_log_celebration')
  })

  it('does not repeat the celebration once seen', () => {
    expect(
      getLogMilestoneAction(
        { isFirstLog: true, totalLogs: 1, isPro: false },
        { celebrationSeen: true, paywallSeen: false }
      )
    ).toBe(null)
  })

  it('stays quiet on logs 1 and 2 for a free user (celebration already seen)', () => {
    const seen = { celebrationSeen: true, paywallSeen: false }
    expect(getLogMilestoneAction({ isFirstLog: false, totalLogs: 1, isPro: false }, seen)).toBe(null)
    expect(getLogMilestoneAction({ isFirstLog: false, totalLogs: 2, isPro: false }, seen)).toBe(null)
  })

  it(`fires the paywall when a free user reaches ${LOG_PAYWALL_THRESHOLD} logs`, () => {
    expect(
      getLogMilestoneAction(
        { isFirstLog: false, totalLogs: LOG_PAYWALL_THRESHOLD, isPro: false },
        { celebrationSeen: true, paywallSeen: false }
      )
    ).toBe('log_paywall')
  })

  it('catches up existing free users far past the threshold (once)', () => {
    expect(
      getLogMilestoneAction(
        { isFirstLog: false, totalLogs: 50, isPro: false },
        { celebrationSeen: true, paywallSeen: false }
      )
    ).toBe('log_paywall')
  })

  it('never re-shows the paywall once seen', () => {
    expect(
      getLogMilestoneAction(
        { isFirstLog: false, totalLogs: 10, isPro: false },
        { celebrationSeen: true, paywallSeen: true }
      )
    ).toBe(null)
  })

  it('never shows the paywall to Pro users', () => {
    expect(
      getLogMilestoneAction(
        { isFirstLog: false, totalLogs: 10, isPro: true },
        { celebrationSeen: true, paywallSeen: false }
      )
    ).toBe(null)
  })

  it('celebration takes precedence over paywall on a first-ever bulk log (no overlay stacking)', () => {
    // e.g. chat flow logging 3 items at once as the user's first log
    expect(
      getLogMilestoneAction({ isFirstLog: true, totalLogs: 3, isPro: false }, seenNone)
    ).toBe('first_log_celebration')
  })
})

describe('nextUnseenStreakMilestone', () => {
  it('celebrates a threshold the day it is reached', () => {
    expect(nextUnseenStreakMilestone(7, [])).toBe(7)
    expect(nextUnseenStreakMilestone(30, [7])).toBe(30)
  })

  it('does not re-celebrate a seen threshold', () => {
    expect(nextUnseenStreakMilestone(8, [7])).toBeNull()
  })

  it('returns the highest reached-but-unseen (existing user past a threshold)', () => {
    expect(nextUnseenStreakMilestone(100, [])).toBe(100)
    expect(nextUnseenStreakMilestone(45, [])).toBe(30)
  })

  it('is null below the first milestone', () => {
    expect(nextUnseenStreakMilestone(6, [])).toBeNull()
  })
})
