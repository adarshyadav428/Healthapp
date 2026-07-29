import { describe, it, expect } from 'vitest'
import {
  SEASONS, currentSeason, seasonLength, daysRemaining, seasonProgress, istDayKey, buildSeasonWrapCards,
} from '../lib/seasons'

const noonIst = (day: string) => new Date(`${day}T06:30:00Z`)
const august = SEASONS[0]

describe('the authored season list', () => {
  it('has unique slugs — they are stored on participation rows', () => {
    const slugs = SEASONS.map((s) => s.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('never overlaps, so `currentSeason` can only ever answer one', () => {
    const sorted = [...SEASONS].sort((a, b) => a.startsOn.localeCompare(b.startsOn))
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].startsOn > sorted[i - 1].endsOn).toBe(true)
    }
  })

  it('sets a target that fits inside the run', () => {
    for (const s of SEASONS) {
      expect(s.target).toBeGreaterThan(0)
      expect(s.target).toBeLessThanOrEqual(seasonLength(s))
    }
  })

  it('gives every season a badge of its own', () => {
    for (const s of SEASONS) {
      expect(s.badge.name.length).toBeGreaterThan(0)
      expect(s.badge.emoji.length).toBeGreaterThan(0)
    }
  })

  it('ships enough runway that nobody has to author one next week', () => {
    expect(SEASONS.length).toBeGreaterThanOrEqual(6)
  })
})

describe('currentSeason', () => {
  it('finds the season running today', () => {
    expect(currentSeason(noonIst('2026-08-15'))?.slug).toBe(august.slug)
  })

  it('includes both end days', () => {
    expect(currentSeason(noonIst(august.startsOn))?.slug).toBe(august.slug)
    expect(currentSeason(noonIst(august.endsOn))?.slug).toBe(august.slug)
  })

  it('returns null in the gap between seasons', () => {
    // 31 Aug sits after the August season ends and before September starts.
    expect(currentSeason(noonIst('2026-08-31'))).toBeNull()
  })

  it('returns null long before the first season', () => {
    expect(currentSeason(noonIst('2026-01-01'))).toBeNull()
  })

  it('reads the day in IST', () => {
    // 2026-07-31T19:00:00Z is 00:30 IST on 1 Aug — the season has started.
    expect(currentSeason(new Date('2026-07-31T19:00:00Z'))?.slug).toBe(august.slug)
    expect(istDayKey(new Date('2026-07-31T19:00:00Z'))).toBe('2026-08-01')
  })
})

describe('daysRemaining', () => {
  it('counts today as remaining — the day is not over', () => {
    expect(daysRemaining(august, noonIst(august.endsOn))).toBe(1)
  })

  it('is 0 once the season has closed', () => {
    expect(daysRemaining(august, noonIst('2026-09-05'))).toBe(0)
  })

  it('counts the whole run on day one', () => {
    expect(daysRemaining(august, noonIst(august.startsOn))).toBe(seasonLength(august))
  })
})

describe('seasonProgress', () => {
  const days = (n: number, from = '2026-08-01') => {
    const base = Date.parse(`${from}T00:00:00Z`)
    return Array.from({ length: n }, (_, i) => new Date(base + i * 86400000).toISOString().slice(0, 10))
  }

  it('counts qualifying days toward the target', () => {
    const p = seasonProgress(august, days(10), noonIst('2026-08-10'))
    expect(p.done).toBe(10)
    expect(p.target).toBe(august.target)
    expect(p.complete).toBe(false)
  })

  it('ignores days outside the run — a season cannot be won in advance', () => {
    const before = ['2026-07-20', '2026-07-25']
    const after = ['2026-09-02']
    const p = seasonProgress(august, [...before, ...after, ...days(3)], noonIst('2026-08-05'))
    expect(p.done).toBe(3)
  })

  it('de-duplicates repeated days', () => {
    const p = seasonProgress(august, ['2026-08-01', '2026-08-01', '2026-08-02'], noonIst('2026-08-03'))
    expect(p.done).toBe(2)
  })

  it('completes at the target and stays complete past it', () => {
    expect(seasonProgress(august, days(august.target), noonIst('2026-08-28')).complete).toBe(true)
    expect(seasonProgress(august, days(august.target + 3), noonIst('2026-08-30')).complete).toBe(true)
  })

  it('caps the fraction at 1 so a bar can never overflow', () => {
    expect(seasonProgress(august, days(august.target + 5), noonIst('2026-08-30')).fraction).toBe(1)
  })

  it('flags a target that can no longer be reached', () => {
    // 2 days done, 3 days left, needs 25 — arithmetically over.
    const p = seasonProgress(august, days(2), noonIst('2026-08-28'))
    expect(p.outOfReach).toBe(true)
  })

  it('does not call a season out of reach while it is still winnable', () => {
    const p = seasonProgress(august, days(20), noonIst('2026-08-24'))
    expect(p.outOfReach).toBe(false)
  })

  it('never calls a completed season out of reach', () => {
    const p = seasonProgress(august, days(august.target), noonIst('2026-08-30'))
    expect(p.outOfReach).toBe(false)
  })

  it('handles a user who did nothing without dividing by zero', () => {
    const p = seasonProgress(august, [], noonIst('2026-08-02'))
    expect(p.done).toBe(0)
    expect(p.fraction).toBe(0)
    expect(Number.isFinite(p.fraction)).toBe(true)
  })
})

describe('buildSeasonWrapCards', () => {
  const wrap = (over = {}) =>
    buildSeasonWrapCards({ season: august, done: 25, complete: true, isPro: true, ...over })

  it('opens on the season and closes on what comes next', () => {
    const cards = wrap()
    expect(cards[0].id).toBe('season-hello')
    expect(cards[0].tone).toBe('ember')
    expect(cards.at(-1)!.id).toBe('season-go')
  })

  it('awards the badge on a win', () => {
    const ids = wrap().map((c) => c.id)
    expect(ids).toContain('season-badge')
    expect(ids).not.toContain('season-near-miss')
  })

  it('counts a near-miss honestly rather than dressing it up', () => {
    // A season that congratulates everyone is worth nothing to the winners.
    const cards = wrap({ done: 22, complete: false })
    const miss = cards.find((c) => c.id === 'season-near-miss')!
    expect(miss.value).toBe('3')
    expect(miss.label).toBe('days short')
    expect(cards.map((c) => c.id)).not.toContain('season-badge')
  })

  it('never shows a negative shortfall', () => {
    const miss = wrap({ done: 99, complete: false }).find((c) => c.id === 'season-near-miss')!
    expect(miss.value).toBe('0')
  })

  it('shows the count against the target either way', () => {
    expect(wrap({ done: 18, complete: false }).find((c) => c.id === 'season-days')!.value)
      .toBe(`18/${august.target}`)
  })

  it('stays serializable and uniquely keyed', () => {
    const cards = wrap()
    expect(JSON.parse(JSON.stringify(cards))).toEqual(cards)
    expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length)
  })
})
