import { describe, it, expect } from 'vitest'
import { formatKg } from '../lib/formatWeight'

describe('formatKg', () => {
  // The bug this exists to prevent: PostgREST hands us unconstrained `numeric`
  // as a string, which rendered as a wall of zeros across the Trends card.
  it('rounds the numeric-as-string values PostgREST actually returns', () => {
    expect(formatKg('84.50000000000000000000')).toBe('84.5')
    expect(formatKg('84.00000000000000000000')).toBe('84.0')
    expect(formatKg('107.25000000000000000000')).toBe('107.3')
  })

  it('handles real numbers too (form state, computed values)', () => {
    expect(formatKg(84.5)).toBe('84.5')
    expect(formatKg(84)).toBe('84.0')
    expect(formatKg(84.449)).toBe('84.4')
    expect(formatKg(84.45)).toBe('84.5')
  })

  it('falls back rather than printing junk for absent values', () => {
    expect(formatKg(null)).toBe('—')
    expect(formatKg(undefined)).toBe('—')
    expect(formatKg('')).toBe('—')
  })

  it('falls back on unparseable input instead of rendering NaN', () => {
    expect(formatKg('not a weight')).toBe('—')
    expect(formatKg(Number.NaN)).toBe('—')
    expect(formatKg(Number.POSITIVE_INFINITY)).toBe('—')
  })

  it('accepts a custom fallback for callers that already append a unit', () => {
    expect(formatKg(null, '--')).toBe('--')
  })

  it('keeps one decimal place so the stat card width stays stable', () => {
    // The card is a fixed-width grid cell; variable digit counts were what
    // pushed the clipped value off the edge in the first place.
    for (const v of ['70', '84.5', '107.25', '99.999']) {
      expect(formatKg(v).split('.')[1]).toHaveLength(1)
    }
  })
})
