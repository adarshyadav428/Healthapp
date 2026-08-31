import { describe, it, expect } from 'vitest'
import {
  limitsForSignupDate,
  LEGACY_LIMITS,
  POST_CUTOFF_LIMITS,
  FREE_TIER_CUTOFF,
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

describe('C1 inertness pin', () => {
  // C2 flips POST_CUTOFF_LIMITS. Until then it must be identical to LEGACY, so
  // limitsForSignupDate is a pure refactor no matter which branch it takes.
  it('POST_CUTOFF_LIMITS deep-equals LEGACY_LIMITS', () => {
    expect(POST_CUTOFF_LIMITS).toEqual(LEGACY_LIMITS)
  })

  it('every current constant value is still what it was', () => {
    expect(LEGACY_LIMITS).toEqual({
      historyDays: 7,
      weightRows: 30,
      suggestions: 3,
      aiScans: 3,
      paywallThreshold: 3,
    })
  })
})
