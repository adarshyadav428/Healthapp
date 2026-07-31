/**
 * Which projection Home shows, and when it shows nothing.
 *
 * The load-bearing rule is the fallback direction: measured → planned ONLY when
 * there is not enough data to measure. If an unfavourable measurement fell back
 * to the planned date, a user who had weighed themselves and GAINED would be
 * told they are on track — the app contradicting the scale, in the app's most
 * confident voice. Several tests below exist purely to keep that door shut.
 */

import { describe, expect, it } from 'vitest'
import { goalProjection, goalProjectionCopy } from '../lib/goalProjection'

const NO_DATA = { kgPerWeek: null, projectedDate: null }
const DEC_5 = new Date('2026-12-05T00:00:00Z')

const base = {
  currentKg: 85,
  targetKg: 75,
  paceKgPerWeek: 0.5,
  now: new Date('2026-07-17T00:00:00Z'),
}

describe('goalProjection — choosing the projection', () => {
  it('prefers the measured trend once there is enough data', () => {
    const result = goalProjection({
      ...base,
      trend: { kgPerWeek: -0.4, projectedDate: DEC_5 },
    })
    expect(result).toEqual({ kind: 'measured', date: DEC_5, kgPerWeek: -0.4 })
  })

  it('falls back to the planned pace before there is enough data', () => {
    const result = goalProjection({ ...base, trend: NO_DATA })
    expect(result.kind).toBe('planned')
    // 10 kg at 0.5/wk = 20 weeks from 17 Jul 2026.
    if (result.kind === 'planned') {
      expect(result.weeks).toBe(20)
      expect(result.date.toISOString().slice(0, 10)).toBe('2026-12-04')
    }
  })

  /**
   * The rule. A measured rate that yields no date means flat or moving away —
   * computeWeightTrend already refuses to project one. Falling back here would
   * replace "we can't say" with "you're on track".
   */
  it('stays silent when the measurement gives no honest date', () => {
    const result = goalProjection({
      ...base,
      trend: { kgPerWeek: +0.3, projectedDate: null }, // gaining, target is lower
    })
    expect(result).toEqual({ kind: 'none', reason: 'off-track' })
  })

  it('does not reach for the planned date when the user is moving away', () => {
    const result = goalProjection({
      ...base,
      paceKgPerWeek: 0.5, // a perfectly good plan, and irrelevant
      trend: { kgPerWeek: +0.3, projectedDate: null },
    })
    expect(result.kind).not.toBe('planned')
  })

  it('stays silent on a flat trend too', () => {
    // Losing nothing is not the same as losing slowly; there is no date.
    const result = goalProjection({
      ...base,
      trend: { kgPerWeek: 0, projectedDate: null },
    })
    expect(result).toEqual({ kind: 'none', reason: 'off-track' })
  })

  it('says nothing without a goal weight', () => {
    expect(goalProjection({ ...base, targetKg: null, trend: NO_DATA })).toEqual({
      kind: 'none',
      reason: 'no-target',
    })
  })

  it('says nothing without a current weight', () => {
    expect(goalProjection({ ...base, currentKg: null, trend: NO_DATA })).toEqual({
      kind: 'none',
      reason: 'no-target',
    })
  })

  it('says nothing once the goal is reached', () => {
    const result = goalProjection({ ...base, currentKg: 75.05, trend: NO_DATA })
    expect(result).toEqual({ kind: 'none', reason: 'at-goal' })
  })

  it('says nothing when there is neither data nor a usable pace', () => {
    const result = goalProjection({ ...base, paceKgPerWeek: 0, trend: NO_DATA })
    expect(result).toEqual({ kind: 'none', reason: 'no-pace' })
  })

  it('projects a gain goal as readily as a loss goal', () => {
    // Underweight users exist and the whole app is direction-agnostic.
    const result = goalProjection({
      ...base,
      currentKg: 55,
      targetKg: 62,
      trend: { kgPerWeek: 0.3, projectedDate: DEC_5 },
    })
    expect(result.kind).toBe('measured')
  })

  it('reaching the goal outranks having no data', () => {
    // Order matters: at-goal is checked before the trend branch, so someone who
    // arrived without weighing in often does not get a planned date to a weight
    // they already are.
    const result = goalProjection({ ...base, currentKg: 75, trend: NO_DATA })
    expect(result).toEqual({ kind: 'none', reason: 'at-goal' })
  })
})

describe('goalProjectionCopy — measured and planned must not sound alike', () => {
  it('states the measured projection as fact', () => {
    const copy = goalProjectionCopy(
      { kind: 'measured', date: DEC_5, kgPerWeek: -0.42 },
      75
    )!
    expect(copy.headline).toContain('On track for 75 kg around 5 Dec 2026')
    expect(copy.detail).toContain('0.42 kg a week')
    // It is a measurement, and says so.
    expect(copy.detail).toMatch(/last few weeks/)
  })

  it('states the planned projection as a condition, not a promise', () => {
    const copy = goalProjectionCopy(
      { kind: 'planned', date: DEC_5, weeks: 20, paceKgPerWeek: 0.5 },
      75
    )!
    // "Keep this up and you'll…" — conditional. Never a flat "you're on track",
    // which is a claim about a pace the user has not yet demonstrated.
    expect(copy.headline).toMatch(/Keep this up/)
    expect(copy.headline).not.toMatch(/On track/)
    expect(copy.detail).toMatch(/becomes a real measurement/)
  })

  it('reports the rate as a magnitude, not a negative number', () => {
    const copy = goalProjectionCopy({ kind: 'measured', date: DEC_5, kgPerWeek: -0.4 }, 75)!
    expect(copy.detail).toContain('0.4 kg a week')
    expect(copy.detail).not.toContain('-0.4')
  })

  it('writes whole weights without a trailing zero', () => {
    const copy = goalProjectionCopy({ kind: 'measured', date: DEC_5, kgPerWeek: -0.5 }, 75)!
    expect(copy.headline).toContain('75 kg')
    expect(copy.headline).not.toContain('75.0')
  })

  it('keeps a half-kilo target intact', () => {
    const copy = goalProjectionCopy({ kind: 'measured', date: DEC_5, kgPerWeek: -0.5 }, 74.5)!
    expect(copy.headline).toContain('74.5 kg')
  })

  it('has nothing to say when there is no projection', () => {
    expect(goalProjectionCopy({ kind: 'none', reason: 'off-track' }, 75)).toBeNull()
  })
})
