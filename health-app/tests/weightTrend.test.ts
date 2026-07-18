import { describe, it, expect } from 'vitest'
import { computeWeightTrend, MIN_DAYS_FOR_TREND, type WeighIn } from '../lib/weightTrend'

const DAY = 86400000
const base = Date.parse('2026-05-01T08:00:00Z')

/** `n` daily weigh-ins starting at `startKg`, changing by `deltaPerDay`. */
function series(n: number, startKg: number, deltaPerDay: number): WeighIn[] {
  return Array.from({ length: n }, (_, i) => ({
    weight_kg: +(startKg + deltaPerDay * i).toFixed(2),
    measured_at: new Date(base + i * DAY).toISOString(),
  }))
}

describe('computeWeightTrend', () => {
  it('is empty for no data', () => {
    expect(computeWeightTrend([], 65)).toEqual({ points: [], kgPerWeek: null, projectedDate: null })
  })

  it('refuses a rate below the minimum span', () => {
    const t = computeWeightTrend(series(MIN_DAYS_FOR_TREND - 1, 80, -0.05), 70)
    expect(t.points.length).toBeGreaterThan(0) // still charts the line
    expect(t.kgPerWeek).toBeNull()
    expect(t.projectedDate).toBeNull()
  })

  it('reports a rate once there is enough span', () => {
    const t = computeWeightTrend(series(MIN_DAYS_FOR_TREND, 80, -0.05), 70)
    expect(t.kgPerWeek).not.toBeNull()
    expect(t.kgPerWeek!).toBeLessThan(0)
  })

  it('smooths a single spike instead of following it', () => {
    const s = series(30, 80, -0.05)
    const cleanLast = computeWeightTrend(s, 70).points.at(-1)!.average
    // A 3kg salty-meal spike on the final day.
    s[s.length - 1] = { ...s[s.length - 1], weight_kg: s[s.length - 1].weight_kg + 3 }
    const spikedLast = computeWeightTrend(s, 70).points.at(-1)!.average
    expect(spikedLast - cleanLast).toBeLessThan(0.5) // absorbed, not tracked
  })

  it('collapses several weigh-ins on one day to the last', () => {
    const day = new Date(base).toISOString()
    const t = computeWeightTrend([
      { weight_kg: 80, measured_at: day },
      { weight_kg: 82, measured_at: new Date(base + 3600000).toISOString() },
    ], null)
    expect(t.points).toHaveLength(1)
    expect(t.points[0].raw).toBe(82)
  })

  it('projects a date when the trend points at the goal', () => {
    const t = computeWeightTrend(series(60, 80, -0.05), 74)
    expect(t.projectedDate).toBeInstanceOf(Date)
    expect(t.projectedDate!.getTime()).toBeGreaterThan(Date.now())
  })

  it('will not project when moving away from the goal', () => {
    // Gaining, but the target is lower — no honest date to give.
    const t = computeWeightTrend(series(60, 80, +0.05), 70)
    expect(t.projectedDate).toBeNull()
  })

  it('will not project from a flat trend', () => {
    const t = computeWeightTrend(series(60, 80, 0), 70)
    expect(t.projectedDate).toBeNull()
  })

  it('will not project an absurdly distant date', () => {
    // 0.001 kg/day against a 10kg gap is decades away.
    const t = computeWeightTrend(series(60, 80, -0.001), 70)
    expect(t.projectedDate).toBeNull()
  })

  it('says nothing about a target already reached', () => {
    const t = computeWeightTrend(series(60, 80, -0.05), 80)
    expect(t.projectedDate).toBeNull()
  })

  it('ignores unparseable rows rather than poisoning the average', () => {
    const s: WeighIn[] = [
      ...series(20, 80, -0.05),
      { weight_kg: NaN, measured_at: new Date(base).toISOString() },
      { weight_kg: 79, measured_at: 'not-a-date' },
    ]
    const t = computeWeightTrend(s, 70)
    expect(t.points.every((p) => Number.isFinite(p.average))).toBe(true)
  })
})
