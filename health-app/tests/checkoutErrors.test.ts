import { describe, it, expect } from 'vitest'
import { CHECKOUT_CANCELLED, isCheckoutCancellation } from '../lib/checkoutErrors'

describe('isCheckoutCancellation', () => {
  it('recognises the exact string Google Play produced on a real device', () => {
    // Captured verbatim from an Android 14 handset on 2026-07-24. This is the
    // message that reached a user as a red "Checkout failed" toast.
    expect(
      isCheckoutCancellation(
        'Payment app returned RESULT_CANCELED code. This is how payment apps can close their activity programmatically.',
      ),
    ).toBe(true)
  })

  it('recognises our own Razorpay dismiss sentinel', () => {
    expect(isCheckoutCancellation(CHECKOUT_CANCELLED)).toBe(true)
  })

  it('recognises a dismissed PaymentRequest sheet', () => {
    expect(isCheckoutCancellation('AbortError: The payment request was aborted')).toBe(true)
  })

  it('accepts both British and American spellings', () => {
    expect(isCheckoutCancellation('Checkout cancelled')).toBe(true)
    expect(isCheckoutCancellation('Purchase canceled by user')).toBe(true)
  })

  it('treats missing or empty messages as real failures, not cancellations', () => {
    expect(isCheckoutCancellation(undefined)).toBe(false)
    expect(isCheckoutCancellation(null)).toBe(false)
    expect(isCheckoutCancellation('')).toBe(false)
  })

  // The expensive direction to get wrong: a genuine billing failure silently
  // reclassified as "the user changed their mind" would hide lost revenue and
  // leave the user believing they simply backed out.
  it('does NOT swallow genuine billing failures', () => {
    const realFailures = [
      'Verification failed',
      'No purchase token returned',
      'Play Billing unavailable',
      'Missing RAZORPAY_KEY_ID',
      'Payment widget failed to load — please retry.',
      'Your card was declined',
      'Network request failed',
      'Item unavailable for purchase',
      'The subscription cancellation fee could not be applied',
    ]
    for (const message of realFailures) {
      expect(isCheckoutCancellation(message), message).toBe(false)
    }
  })
})
