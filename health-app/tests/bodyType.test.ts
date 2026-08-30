/**
 * The body-focus → goal derivation.
 *
 * The contract this pins is the reason the feature could ship surgically:
 * `body_focus` is what the user picks (four values), `goal` stays three-valued
 * so the ~20 modules that branch on it need no re-audit, and `planForFocus` is
 * the single mapping between them. A fourth `goal` value leaking out of here
 * is the regression these tests exist to catch.
 */

import { describe, it, expect } from 'vitest'
import {
  BODY_FOCUSES,
  BODY_TYPES,
  BODY_FOCUS_META,
  BODY_TYPE_META,
  RECOMP_PACE_KG_PER_WEEK,
  planForFocus,
  focusFromBodyType,
  focusFromProfile,
} from '../lib/bodyType'

const LEGACY_GOALS = ['lose', 'maintain', 'gain'] as const

describe('planForFocus', () => {
  it('never returns a goal outside the three-value enum', () => {
    for (const focus of BODY_FOCUSES) {
      expect(LEGACY_GOALS).toContain(planForFocus(focus).goal)
    }
  })

  it('recomp is a gentle deficit, not a fourth goal', () => {
    expect(planForFocus('recomp')).toEqual({ goal: 'lose', pace: RECOMP_PACE_KG_PER_WEEK })
    expect(RECOMP_PACE_KG_PER_WEEK).toBe(0.25)
  })

  it('muscle_gain is a gentle surplus at the same pace', () => {
    expect(planForFocus('muscle_gain')).toEqual({ goal: 'gain', pace: RECOMP_PACE_KG_PER_WEEK })
  })

  it('fat_loss and maintain leave the pace alone for the user to pick', () => {
    expect(planForFocus('fat_loss')).toEqual({ goal: 'lose', pace: null })
    expect(planForFocus('maintain')).toEqual({ goal: 'maintain', pace: null })
  })

  it('only the muscle focuses pin a pace', () => {
    const pinned = BODY_FOCUSES.filter((f) => planForFocus(f).pace !== null)
    expect(pinned).toEqual(['recomp', 'muscle_gain'])
  })
})

describe('focusFromBodyType', () => {
  it('maps every body type to a real focus', () => {
    for (const type of BODY_TYPES) {
      expect(BODY_FOCUSES).toContain(focusFromBodyType(type))
    }
  })

  it('skinny starts on building, softer starts on fat loss', () => {
    expect(focusFromBodyType('skinny')).toBe('muscle_gain')
    expect(focusFromBodyType('soft')).toBe('fat_loss')
  })

  it('skinny fat, average and athletic all start on recomp', () => {
    expect(focusFromBodyType('skinny_fat')).toBe('recomp')
    expect(focusFromBodyType('average')).toBe('recomp')
    expect(focusFromBodyType('athletic')).toBe('recomp')
  })
})

describe('focusFromProfile', () => {
  it('prefers a stored body_focus', () => {
    expect(focusFromProfile({ body_focus: 'recomp', goal: 'lose' })).toBe('recomp')
    expect(focusFromProfile({ body_focus: 'maintain', goal: 'lose' })).toBe('maintain')
  })

  it('falls back to the legacy goal for every pre-migration profile', () => {
    // Every account that onboarded before migration 040 has body_focus NULL.
    expect(focusFromProfile({ body_focus: null, goal: 'lose' })).toBe('fat_loss')
    expect(focusFromProfile({ body_focus: null, goal: 'maintain' })).toBe('maintain')
    expect(focusFromProfile({ body_focus: null, goal: 'gain' })).toBe('muscle_gain')
    expect(focusFromProfile({ goal: 'lose' })).toBe('fat_loss')
  })

  it('ignores a junk body_focus rather than selecting nothing', () => {
    // The column has no CHECK constraint, so a bad value is reachable.
    expect(focusFromProfile({ body_focus: 'nonsense' as never, goal: 'gain' })).toBe('muscle_gain')
  })

  it('round-trips: a focus derived from a profile plans back to that profile goal', () => {
    for (const goal of LEGACY_GOALS) {
      expect(planForFocus(focusFromProfile({ goal })).goal).toBe(goal)
    }
  })
})

describe('metadata', () => {
  it('every focus and body type has copy to render', () => {
    for (const f of BODY_FOCUSES) {
      expect(BODY_FOCUS_META[f].label.length).toBeGreaterThan(0)
      expect(BODY_FOCUS_META[f].emoji.length).toBeGreaterThan(0)
    }
    for (const t of BODY_TYPES) {
      expect(BODY_TYPE_META[t].label.length).toBeGreaterThan(0)
    }
  })

  it('recomp is the tile that says both halves out loud', () => {
    expect(BODY_FOCUS_META.recomp.label).toMatch(/muscle/i)
    expect(BODY_FOCUS_META.recomp.label).toMatch(/fat/i)
  })
})
