import { describe, it, expect } from 'vitest'
import {
  limitsForSignupDate,
  LEGACY_LIMITS,
  POST_CUTOFF_LIMITS,
  FREE_TIER_CUTOFF,
  type FreeTierLimits,
} from '../lib/freeTier'

describe('limitsForSignupDate', () => {
  it('returns LEGACY limits for an account created well before the cutoff', () => {
    expect(limitsForSignupDate('2020-01-01T00:00:00Z')).toEqual(LEGACY_LIMITS)
  })

  it('returns POST_CUTOFF limits for an account created after the cutoff', () => {
    const afterCutoff = new Date(Date.parse(FREE_TIER_CUTOFF) + 86_400_000).toISOString()
    expect(limitsForSignupDate(afterCutoff)).toEqual(POST_CUTOFF_LIMITS)
  })

  it('falls back to LEGACY (generous) limits for a null or missing createdAt', () => {
    expect(limitsForSignupDate(null)).toEqual(LEGACY_LIMITS)
    expect(limitsForSignupDate(undefined)).toEqual(LEGACY_LIMITS)
  })

  it('falls back to LEGACY limits for an unparseable createdAt', () => {
    expect(limitsForSignupDate('garbage')).toEqual(LEGACY_LIMITS)
  })
})

describe('the two tiers', () => {
  // LEGACY is what a pre-cutoff account keeps forever — and what every
  // hand-maintained constant held before consolidation. Changing this is a
  // "Free forever" breach; it must not move.
  it('LEGACY_LIMITS are the pre-repositioning values', () => {
    expect(LEGACY_LIMITS).toEqual({
      historyDays: 7,
      weightRows: 30,
      suggestions: 3,
      aiScans: 3,
      paywallThreshold: 3,
    })
  })

  // POST_CUTOFF is the new-signup tier. These are the only numbers the
  // repositioning moves, and every one is a one-line revert.
  it('POST_CUTOFF_LIMITS tightens history, weight and the paywall — not the AI trial', () => {
    expect(POST_CUTOFF_LIMITS).toEqual({
      historyDays: 5,
      weightRows: 14,
      suggestions: 3,
      aiScans: 3,
      paywallThreshold: 2,
    })
  })

  it('never loosens anything relative to LEGACY', () => {
    for (const k of Object.keys(LEGACY_LIMITS) as (keyof FreeTierLimits)[]) {
      expect(POST_CUTOFF_LIMITS[k]).toBeLessThanOrEqual(LEGACY_LIMITS[k])
    }
  })
})
