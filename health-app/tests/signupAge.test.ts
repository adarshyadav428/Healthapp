import { describe, it, expect } from 'vitest'
import { daysSinceSignupFrom } from '../lib/signupAge'

const NOW = new Date('2026-08-29T12:00:00.000Z').getTime()

describe('daysSinceSignupFrom', () => {
  it('floors to whole days', () => {
    expect(daysSinceSignupFrom('2026-08-27T00:00:00Z', NOW)).toBe(2)
    expect(daysSinceSignupFrom('2026-08-27T23:00:00Z', NOW)).toBe(1)
  })

  it('is 0 on the signup day', () => {
    expect(daysSinceSignupFrom('2026-08-29T01:00:00Z', NOW)).toBe(0)
  })

  it('is null for a missing or unparseable timestamp', () => {
    expect(daysSinceSignupFrom(null, NOW)).toBeNull()
    expect(daysSinceSignupFrom(undefined, NOW)).toBeNull()
    expect(daysSinceSignupFrom('not a date', NOW)).toBeNull()
  })
})
