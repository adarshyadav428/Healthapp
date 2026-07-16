import { describe, it, expect } from 'vitest'
import { computeWeightMilestone } from '../lib/weightMilestone'

const pt = (weight_kg: number, measured_at: string) => ({ weight_kg, measured_at })

describe('computeWeightMilestone', () => {
  it('returns null for the very first weigh-in', () => {
    expect(
      computeWeightMilestone({ baseline: null, minWeightKg: null, entry: pt(80, '2026-07-16') })
    ).toBe(null)
  })

  it('celebrates crossing the first whole kg', () => {
    expect(
      computeWeightMilestone({
        baseline: pt(82, '2026-07-01'),
        minWeightKg: 81.5, // best so far: 0.5 kg
        entry: pt(80.9, '2026-07-16'), // now 1.1 kg
      })
    ).toBe(1)
  })

  it('reports the total kg lost when skipping thresholds', () => {
    expect(
      computeWeightMilestone({
        baseline: pt(82, '2026-07-01'),
        minWeightKg: 81.2, // best so far: 0.8 kg
        entry: pt(78.8, '2026-07-16'), // now 3.2 kg
      })
    ).toBe(3)
  })

  it('stays quiet when no new threshold is crossed', () => {
    // best 1.5 kg → now 1.9 kg: still inside the same whole-kg band
    expect(
      computeWeightMilestone({
        baseline: pt(82, '2026-07-01'),
        minWeightKg: 80.5,
        entry: pt(80.1, '2026-07-16'),
      })
    ).toBe(null)
  })

  it('never re-fires an already-reached threshold (weight bounced back)', () => {
    // best 2.3 kg (floor 2) → regained, now back down to 2.1 kg (floor 2)
    expect(
      computeWeightMilestone({
        baseline: pt(82, '2026-07-01'),
        minWeightKg: 79.7,
        entry: pt(79.9, '2026-07-16'),
      })
    ).toBe(null)
  })

  it('ignores weight gain', () => {
    expect(
      computeWeightMilestone({
        baseline: pt(82, '2026-07-01'),
        minWeightKg: 82,
        entry: pt(83, '2026-07-16'),
      })
    ).toBe(null)
  })

  it('never celebrates a back-dated entry older than the baseline', () => {
    expect(
      computeWeightMilestone({
        baseline: pt(82, '2026-07-01'),
        minWeightKg: 80,
        entry: pt(75, '2026-06-15'), // rewrites history, not an achievement
      })
    ).toBe(null)
  })

  it('handles 0.1-step float noise at an exact threshold', () => {
    // 82 - 79 = 3 exactly under floats-with-noise: 82.0 - 78.9 - 0.1-steps
    expect(
      computeWeightMilestone({
        baseline: pt(82, '2026-07-01'),
        minWeightKg: 79.5, // best 2.5 → floor 2
        entry: pt(79, '2026-07-16'), // exactly 3.0
      })
    ).toBe(3)
  })
})
