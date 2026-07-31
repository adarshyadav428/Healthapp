import { describe, it, expect } from 'vitest'
import { userFacingApiError, GENERIC_ERROR } from '../lib/apiError'

describe('userFacingApiError', () => {
  it('relays a 4xx message — it was written for the user', () => {
    expect(userFacingApiError(400, 'Age cannot exceed 120')).toBe('Age cannot exceed 120')
    expect(userFacingApiError(402, 'Custom foods are a Pro feature')).toBe('Custom foods are a Pro feature')
    expect(userFacingApiError(499, 'Edge of the range')).toBe('Edge of the range')
  })

  it('never relays a 5xx message — that one was written for us', () => {
    // The real shapes that reached users before this existed.
    expect(userFacingApiError(500, 'duplicate key value violates unique constraint "food_logs_pkey"')).toBe(GENERIC_ERROR)
    expect(userFacingApiError(500, 'Missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET')).toBe(GENERIC_ERROR)
    expect(userFacingApiError(503, 'upstream connect error')).toBe(GENERIC_ERROR)
  })

  it('falls back when there is no message at all', () => {
    expect(userFacingApiError(400, null)).toBe(GENERIC_ERROR)
    expect(userFacingApiError(400, '   ')).toBe(GENERIC_ERROR)
    expect(userFacingApiError(400, undefined)).toBe(GENERIC_ERROR)
  })

  it('treats a network failure (no status) as unsafe', () => {
    // fetch rejected, or an opaque/CORS response — not a considered rejection.
    expect(userFacingApiError(0, 'Failed to fetch')).toBe(GENERIC_ERROR)
  })

  it('accepts a caller-specific fallback', () => {
    expect(userFacingApiError(500, 'pg: deadlock detected', 'Could not save your weight.')).toBe('Could not save your weight.')
  })
})
