import { describe, it, expect } from 'vitest'
import { isProStatus } from '../lib/subscription'

describe('isProStatus', () => {
  it('treats active and trialing as Pro', () => {
    expect(isProStatus('active')).toBe(true)
    expect(isProStatus('trialing')).toBe(true)
  })

  it('treats every other status as free', () => {
    expect(isProStatus('canceled')).toBe(false)
    expect(isProStatus('past_due')).toBe(false)
    expect(isProStatus('')).toBe(false)
    expect(isProStatus('ACTIVE')).toBe(false) // status vocab is lowercase
  })

  it('handles missing subscription rows', () => {
    expect(isProStatus(null)).toBe(false)
    expect(isProStatus(undefined)).toBe(false)
  })
})
