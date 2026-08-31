import { describe, it, expect } from 'vitest'
import { deficitAccess, DEFICIT_TASTE_DAYS } from '../lib/deficitAccess'
import { FREE_TIER_CUTOFF } from '../lib/freeTier'

const cutoffMs = Date.parse(FREE_TIER_CUTOFF)
const DAY = 86_400_000

describe('deficitAccess', () => {
  it('allows Pro users regardless of signup date', () => {
    // Post-cutoff, well past the taste window — still allowed because Pro.
    const createdAt = new Date(cutoffMs + 10 * DAY).toISOString()
    const now = cutoffMs + 100 * DAY
    expect(deficitAccess({ isPro: true, createdAt, now })).toEqual({ allowed: true })
  })

  it('allows a free account that signed up before the cutoff (grandfathered)', () => {
    const createdAt = new Date(cutoffMs - 30 * DAY).toISOString()
    const now = cutoffMs + 365 * DAY
    expect(deficitAccess({ isPro: false, createdAt, now })).toEqual({ allowed: true })
  })

  it('allows a post-cutoff free account inside the taste window', () => {
    const createdAt = new Date(cutoffMs + 5 * DAY).toISOString()
    const now = cutoffMs + 5 * DAY + (DEFICIT_TASTE_DAYS - 1) * DAY
    expect(deficitAccess({ isPro: false, createdAt, now })).toEqual({ allowed: true })
  })

  it('denies a post-cutoff free account once the taste window has expired', () => {
    const createdAt = new Date(cutoffMs + 5 * DAY).toISOString()
    const now = cutoffMs + 5 * DAY + (DEFICIT_TASTE_DAYS + 1) * DAY
    expect(deficitAccess({ isPro: false, createdAt, now })).toEqual({
      allowed: false,
      reason: 'taste_expired',
    })
  })

  it('denies exactly at the taste boundary (age === DEFICIT_TASTE_DAYS)', () => {
    const createdAt = new Date(cutoffMs + 5 * DAY).toISOString()
    const now = cutoffMs + 5 * DAY + DEFICIT_TASTE_DAYS * DAY
    expect(deficitAccess({ isPro: false, createdAt, now })).toEqual({
      allowed: false,
      reason: 'taste_expired',
    })
  })

  it('fails open for null createdAt', () => {
    expect(deficitAccess({ isPro: false, createdAt: null, now: cutoffMs + 999 * DAY })).toEqual({
      allowed: true,
    })
  })

  it('fails open for an unparseable createdAt', () => {
    expect(
      deficitAccess({ isPro: false, createdAt: 'not-a-date', now: cutoffMs + 999 * DAY }),
    ).toEqual({ allowed: true })
  })
})
