import { describe, it, expect } from 'vitest'
import {
  suggestTargetAdjustment,
  MAX_STEP_KCAL,
  MIN_DAYS_LOGGED,
  MIN_SAFE_KCAL,
} from '../lib/adaptiveTarget'

const base = {
  currentTarget: 1800,
  goalKgPerWeek: 0.5,
  goal: 'lose' as const,
  daysLogged: 7,
}

describe('suggestTargetAdjustment', () => {
  it('lowers the target when weight loss stalls', () => {
    const s = suggestTargetAdjustment({ ...base, actualKgChange: 0 })
    expect(s).not.toBeNull()
    expect(s!.deltaKcal).toBeLessThan(0)
    expect(s!.newTarget).toBeLessThan(base.currentTarget)
  })

  it('raises the target when losing faster than planned', () => {
    const s = suggestTargetAdjustment({ ...base, actualKgChange: -1.2 })
    expect(s!.deltaKcal).toBeGreaterThan(0)
    expect(s!.reason).toContain('sustainable')
  })

  it('never moves more than one step in a week', () => {
    // A wildly off week that would imply a huge correction.
    const s = suggestTargetAdjustment({ ...base, actualKgChange: 3 })
    expect(Math.abs(s!.deltaKcal)).toBeLessThanOrEqual(MAX_STEP_KCAL)
  })

  it('ignores deviations inside the deadband', () => {
    // Lost 0.55kg against a 0.5kg goal — noise, not a signal.
    expect(suggestTargetAdjustment({ ...base, actualKgChange: -0.55 })).toBeNull()
    expect(suggestTargetAdjustment({ ...base, actualKgChange: -0.5 })).toBeNull()
  })

  it('will not adjust on a thinly logged week', () => {
    const s = suggestTargetAdjustment({ ...base, actualKgChange: 0, daysLogged: MIN_DAYS_LOGGED - 1 })
    expect(s).toBeNull()
  })

  it('adjusts once enough days are logged', () => {
    const s = suggestTargetAdjustment({ ...base, actualKgChange: 0, daysLogged: MIN_DAYS_LOGGED })
    expect(s).not.toBeNull()
  })

  it('never recommends below the safe floor', () => {
    const s = suggestTargetAdjustment({ ...base, currentTarget: MIN_SAFE_KCAL + 50, actualKgChange: 0 })
    expect(s === null || s.newTarget >= MIN_SAFE_KCAL).toBe(true)
  })

  it('says nothing when the floor swallows the whole adjustment', () => {
    const s = suggestTargetAdjustment({ ...base, currentTarget: MIN_SAFE_KCAL, actualKgChange: 0 })
    expect(s).toBeNull()
  })

  it('leaves maintainers alone — there is no intended drift to correct', () => {
    const s = suggestTargetAdjustment({ ...base, goal: 'maintain', actualKgChange: -0.8 })
    expect(s).toBeNull()
  })

  it('raises the target for a gainer who is gaining too slowly', () => {
    const s = suggestTargetAdjustment({ ...base, goal: 'gain', actualKgChange: 0 })
    expect(s!.deltaKcal).toBeGreaterThan(0)
  })

  it('lowers the target for a gainer gaining too fast', () => {
    const s = suggestTargetAdjustment({ ...base, goal: 'gain', actualKgChange: 1.5 })
    expect(s!.deltaKcal).toBeLessThan(0)
  })

  it('rejects unusable inputs rather than inventing a target', () => {
    expect(suggestTargetAdjustment({ ...base, currentTarget: 0, actualKgChange: 0 })).toBeNull()
    expect(suggestTargetAdjustment({ ...base, actualKgChange: NaN })).toBeNull()
  })

  it('repeated stalled weeks drift the target down, never lurch it', () => {
    let target = 2000
    for (let week = 0; week < 4; week++) {
      const s = suggestTargetAdjustment({ ...base, currentTarget: target, actualKgChange: 0 })
      expect(Math.abs(s!.deltaKcal)).toBeLessThanOrEqual(MAX_STEP_KCAL)
      target = s!.newTarget
    }
    expect(target).toBeGreaterThanOrEqual(MIN_SAFE_KCAL)
    expect(target).toBeLessThan(2000)
  })
})
