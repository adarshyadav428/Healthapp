import { describe, it, expect } from 'vitest'
import { todayUtcStr, shiftDateStr, logHref, decideSwipe } from '../lib/logDates'

describe('todayUtcStr / shiftDateStr', () => {
  it('formats the UTC date with zero padding', () => {
    expect(todayUtcStr(new Date('2026-07-06T01:00:00Z'))).toBe('2026-07-06')
  })

  it('shifts across month and year boundaries', () => {
    expect(shiftDateStr('2026-07-01', -1)).toBe('2026-06-30')
    expect(shiftDateStr('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDateStr('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('logHref', () => {
  it('gives today the canonical bare URL', () => {
    expect(logHref('2026-07-16', '2026-07-16')).toBe('/log')
    expect(logHref('2026-07-15', '2026-07-16')).toBe('/log?date=2026-07-15')
  })
})

describe('decideSwipe', () => {
  it('classifies deliberate horizontal swipes', () => {
    expect(decideSwipe(-120, 10)).toBe('next')
    expect(decideSwipe(120, -10)).toBe('prev')
  })

  it('ignores short movements', () => {
    expect(decideSwipe(-40, 0)).toBe(null)
  })

  it('ignores diagonal/vertical gestures (page scrolling)', () => {
    expect(decideSwipe(-80, 60)).toBe(null)
    expect(decideSwipe(80, -50)).toBe(null)
  })
})
