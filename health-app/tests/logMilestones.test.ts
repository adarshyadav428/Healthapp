import { describe, it, expect } from 'vitest'
import { getLogMilestoneAction, LOG_PAYWALL_THRESHOLD, nextUnseenStreakMilestone, isShareableStreakMilestone } from '../lib/logMilestones'

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

  it('stays quiet below the threshold for a free user (celebration already seen)', () => {
    // Derived from the constant rather than hardcoded, so moving the threshold
    // changes one number instead of silently leaving a test asserting the old
    // behaviour under a name that still sounds right.
    const seen = { celebrationSeen: true, paywallSeen: false }
    for (let logs = 1; logs < LOG_PAYWALL_THRESHOLD; logs++) {
      expect(getLogMilestoneAction({ isFirstLog: false, totalLogs: logs, isPro: false }, seen)).toBe(null)
    }
  })

  it('lands on the log straight after the first-log celebration', () => {
    // The whole point of moving the threshold: the ask should reach the users
    // who log twice and stop, not only those who reach three. If this ever
    // needs the celebration and the paywall on the *same* log, that is a
    // different (and worse) design — two overlays stacked on one action.
    const seen = { celebrationSeen: true, paywallSeen: false }
    expect(getLogMilestoneAction({ isFirstLog: false, totalLogs: 2, isPro: false }, seen)).toBe('log_paywall')
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
    expect(nextUnseenStreakMilestone(2, [])).toBeNull()
    expect(nextUnseenStreakMilestone(0, [])).toBeNull()
  })

  // The v2 ladder added early rungs (3, 14, 21). Only the highest REACHED rung
  // is ever a candidate, so gaining rungs cannot hand an established user a
  // stale celebration for a threshold they passed long ago.
  it('celebrates the new early rungs', () => {
    expect(nextUnseenStreakMilestone(3, [])).toBe(3)
    expect(nextUnseenStreakMilestone(6, [])).toBe(3)
    expect(nextUnseenStreakMilestone(14, [3, 7])).toBe(14)
    expect(nextUnseenStreakMilestone(21, [3, 7, 14])).toBe(21)
    expect(nextUnseenStreakMilestone(50, [30])).toBe(50)
  })

  it('never surfaces a lower rung once a higher one is seen', () => {
    // Day-7 celebrated; day 3 was silently passed. Must stay quiet.
    expect(nextUnseenStreakMilestone(8, [7])).toBeNull()
    expect(nextUnseenStreakMilestone(13, [7])).toBeNull()
    // But a genuinely higher unseen rung still fires — at 29 days the highest
    // reached is 21, which they have not celebrated yet.
    expect(nextUnseenStreakMilestone(29, [7])).toBe(21)
  })
})

describe('isShareableStreakMilestone', () => {
  it('offers a share card only at the three big rungs', () => {
    expect(isShareableStreakMilestone(7)).toBe(true)
    expect(isShareableStreakMilestone(30)).toBe(true)
    expect(isShareableStreakMilestone(100)).toBe(true)
  })

  it('stays quiet on the smaller rungs so the prompt keeps its weight', () => {
    for (const d of [3, 14, 21, 50]) expect(isShareableStreakMilestone(d)).toBe(false)
  })
})
