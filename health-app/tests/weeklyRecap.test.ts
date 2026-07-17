import { describe, it, expect } from 'vitest'
import { computeRecapStats, recapFallbackMessage, recapWeekStart } from '../lib/weeklyRecap'

describe('computeRecapStats', () => {
  it('averages only the days that were logged', () => {
    const s = computeRecapStats([1500, 0, 1600, 1400], 85, 84.2)
    expect(s.daysLogged).toBe(3)
    expect(s.avgKcal).toBe(1500)
    expect(s.weightDeltaKg).toBe(-0.8)
  })

  it('returns null weight delta with fewer than two weigh-ins', () => {
    expect(computeRecapStats([1500], 85, null).weightDeltaKg).toBeNull()
    expect(computeRecapStats([1500], null, null).weightDeltaKg).toBeNull()
  })

  it('handles a fully empty week', () => {
    const s = computeRecapStats([], null, null)
    expect(s).toEqual({ daysLogged: 0, avgKcal: 0, weightDeltaKg: null })
  })
})

describe('recapFallbackMessage', () => {
  it('mentions weight loss when down', () => {
    const msg = recapFallbackMessage({ daysLogged: 6, avgKcal: 1500, weightDeltaKg: -0.8 }, 'Adarsh')
    expect(msg).toContain('Adarsh')
    expect(msg).toContain('0.8 kg')
  })

  it('nudges gently on an empty week', () => {
    expect(recapFallbackMessage({ daysLogged: 0, avgKcal: 0, weightDeltaKg: null })).toMatch(/fresh week/i)
  })
})

describe('recapWeekStart', () => {
  it('is 6 days before the given IST date', () => {
    expect(recapWeekStart('2026-07-19')).toBe('2026-07-13')
  })
  it('crosses a month boundary correctly', () => {
    expect(recapWeekStart('2026-07-03')).toBe('2026-06-27')
  })
})
