import { describe, it, expect } from 'vitest'
import { computeBadges, earnedCount, type BadgeStats } from '../lib/badges'

const empty: BadgeStats = {
  totalLogs: 0,
  currentStreak: 0,
  longestStreak: 0,
  proteinTargetDaysHit: 0,
  weighIns: 0,
  savedMealTemplates: 0,
  kgLost: null,
}

describe('computeBadges', () => {
  it('is exactly ten badges, always', () => {
    expect(computeBadges(empty)).toHaveLength(10)
    expect(computeBadges({ ...empty, totalLogs: 999, longestStreak: 999 })).toHaveLength(10)
  })

  it('has no duplicate ids', () => {
    const ids = computeBadges(empty).map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('earns nothing on a brand-new account', () => {
    expect(earnedCount(computeBadges(empty))).toBe(0)
  })

  it('earns First Step on the very first log', () => {
    const badges = computeBadges({ ...empty, totalLogs: 1 })
    expect(badges.find((b) => b.id === 'first_log')!.earned).toBe(true)
  })

  it('keeps a streak badge after the streak breaks', () => {
    // Reached 30 once, currently back to zero — the badge stays earned.
    const badges = computeBadges({ ...empty, longestStreak: 30, currentStreak: 0 })
    expect(badges.find((b) => b.id === 'consistent')!.earned).toBe(true)
    expect(badges.find((b) => b.id === 'week_one')!.earned).toBe(true)
  })

  it('counts the current streak when it exceeds the recorded longest', () => {
    const badges = computeBadges({ ...empty, longestStreak: 3, currentStreak: 8 })
    expect(badges.find((b) => b.id === 'week_one')!.earned).toBe(true)
  })

  it('earns lower streak rungs when a higher one is reached', () => {
    const badges = computeBadges({ ...empty, longestStreak: 100 })
    for (const id of ['week_one', 'fortnight', 'consistent', 'centurion']) {
      expect(badges.find((b) => b.id === id)!.earned).toBe(true)
    }
  })

  it('reports partial progress toward an unearned badge', () => {
    const badges = computeBadges({ ...empty, longestStreak: 15 })
    const consistent = badges.find((b) => b.id === 'consistent')!
    expect(consistent.earned).toBe(false)
    expect(consistent.progress).toBeCloseTo(0.5, 2)
  })

  it('never reports progress outside 0–1', () => {
    const badges = computeBadges({ ...empty, longestStreak: 5000, totalLogs: 5000, kgLost: 90 })
    for (const b of badges) {
      expect(b.progress).toBeGreaterThanOrEqual(0)
      expect(b.progress).toBeLessThanOrEqual(1)
    }
  })

  it('treats no weight loss and weight gain as zero progress, not negative', () => {
    const gained = computeBadges({ ...empty, kgLost: -3 })
    const kilo = gained.find((b) => b.id === 'first_kilo')!
    expect(kilo.earned).toBe(false)
    expect(kilo.progress).toBe(0)

    const unknown = computeBadges({ ...empty, kgLost: null })
    expect(unknown.find((b) => b.id === 'first_kilo')!.progress).toBe(0)
  })

  it('earns the weight badges at their thresholds', () => {
    expect(computeBadges({ ...empty, kgLost: 1 }).find((b) => b.id === 'first_kilo')!.earned).toBe(true)
    expect(computeBadges({ ...empty, kgLost: 5 }).find((b) => b.id === 'five_down')!.earned).toBe(true)
    expect(computeBadges({ ...empty, kgLost: 4.9 }).find((b) => b.id === 'five_down')!.earned).toBe(false)
  })

  it('covers all four kinds of progress so no one is locked out', () => {
    // Someone who logs faithfully but has lost nothing still earns plenty.
    const loyal = computeBadges({
      ...empty, totalLogs: 200, longestStreak: 30, proteinTargetDaysHit: 7,
      weighIns: 10, savedMealTemplates: 3, kgLost: 0,
    })
    expect(earnedCount(loyal)).toBe(7)
  })

  it('can earn all ten', () => {
    const everything = computeBadges({
      totalLogs: 500, currentStreak: 100, longestStreak: 100, proteinTargetDaysHit: 50,
      weighIns: 40, savedMealTemplates: 6, kgLost: 8,
    })
    expect(earnedCount(everything)).toBe(10)
  })
})
