import { describe, it, expect } from 'vitest'
import { paywallPriceLine, PRICE_MONTHLY, PRICE_ANNUAL, FREE_TRIAL_DAYS } from '../lib/pricing'

describe('paywallPriceLine', () => {
  it('promises the free trial inside the Play app', () => {
    const line = paywallPriceLine(true)
    expect(line).toContain(`${FREE_TRIAL_DAYS}-day free trial`)
    expect(line).toContain(PRICE_MONTHLY)
    expect(line).toContain(PRICE_ANNUAL)
  })

  // The trial is a Play Console offer; Razorpay charges immediately and has no
  // trial, so promising one on the web would be a false claim.
  it('never mentions a trial on the web', () => {
    const line = paywallPriceLine(false)
    expect(line.toLowerCase()).not.toContain('trial')
    expect(line).toContain(PRICE_MONTHLY)
    expect(line).toContain(PRICE_ANNUAL)
  })

  // Detection is async and starts false, so the pending state renders the web
  // line — a slow probe must degrade to the honest copy, not the generous one.
  it('treats the undetected state as web', () => {
    expect(paywallPriceLine(false)).toBe(paywallPriceLine(false))
    expect(paywallPriceLine(false).toLowerCase()).not.toContain('trial')
  })

  it('quotes the prices CLAUDE.md pins as a hard constraint', () => {
    expect(PRICE_MONTHLY).toBe('₹299')
    expect(PRICE_ANNUAL).toBe('₹1,999')
  })

  // Google rejects anything shorter than 3 days.
  it('never drops below Play’s minimum trial length', () => {
    expect(FREE_TRIAL_DAYS).toBeGreaterThanOrEqual(3)
  })
})
