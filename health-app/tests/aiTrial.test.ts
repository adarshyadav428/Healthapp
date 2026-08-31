import { describe, it, expect } from 'vitest'
import { decideAiTrial, aiScansLeftLabel, AI_TRIAL_SCANS } from '../lib/aiTrial'

const VERIFIED = '2026-07-01T00:00:00Z'

describe('decideAiTrial', () => {
  it('allows a verified user who has never scanned, with the full allowance', () => {
    expect(decideAiTrial({ emailVerifiedAt: VERIFIED, usedCount: 0 }))
      .toEqual({ allowed: true, remaining: AI_TRIAL_SCANS })
  })

  it('counts down as scans are used', () => {
    expect(decideAiTrial({ emailVerifiedAt: VERIFIED, usedCount: 1 }))
      .toEqual({ allowed: true, remaining: AI_TRIAL_SCANS - 1 })
  })

  it('allows the final scan in the allowance', () => {
    expect(decideAiTrial({ emailVerifiedAt: VERIFIED, usedCount: AI_TRIAL_SCANS - 1 }))
      .toEqual({ allowed: true, remaining: 1 })
  })

  it('blocks exactly at the limit — the allowance is inclusive of the last scan, not one more', () => {
    expect(decideAiTrial({ emailVerifiedAt: VERIFIED, usedCount: AI_TRIAL_SCANS }))
      .toEqual({ allowed: false, block: 'exhausted' })
  })

  it('stays blocked past the limit (a race could overshoot the counter)', () => {
    expect(decideAiTrial({ emailVerifiedAt: VERIFIED, usedCount: AI_TRIAL_SCANS + 5 }))
      .toEqual({ allowed: false, block: 'exhausted' })
  })

  it('blocks an unverified user even with the whole allowance untouched', () => {
    expect(decideAiTrial({ emailVerifiedAt: null, usedCount: 0 }))
      .toEqual({ allowed: false, block: 'unverified' })
  })

  it('reports unverified, not exhausted, when both apply — verifying is the action that helps', () => {
    expect(decideAiTrial({ emailVerifiedAt: null, usedCount: 99 }))
      .toEqual({ allowed: false, block: 'unverified' })
  })

  it('honours an explicit limit override', () => {
    expect(decideAiTrial({ emailVerifiedAt: VERIFIED, usedCount: 1, limit: 1 }))
      .toEqual({ allowed: false, block: 'exhausted' })
  })

  it('treats a zero limit as no trial at all', () => {
    expect(decideAiTrial({ emailVerifiedAt: VERIFIED, usedCount: 0, limit: 0 }))
      .toEqual({ allowed: false, block: 'exhausted' })
  })
})

describe('aiScansLeftLabel', () => {
  it('renders nothing for Pro / unknown (null) or a negative count', () => {
    expect(aiScansLeftLabel(null)).toBeNull()
    expect(aiScansLeftLabel(-1)).toBeNull()
  })

  it('counts down in the plural above one', () => {
    expect(aiScansLeftLabel(3)).toBe('3 free AI scans left')
    expect(aiScansLeftLabel(2)).toBe('2 free AI scans left')
  })

  it('names the last one as the last one', () => {
    expect(aiScansLeftLabel(1)).toBe('This is your last free AI scan')
  })

  it('says the wall is here at zero', () => {
    expect(aiScansLeftLabel(0)).toBe('No free AI scans left')
  })
})
