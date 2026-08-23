import { describe, it, expect } from 'vitest'
import { userFacingApiError, zodErrorMessage, GENERIC_ERROR } from '../lib/apiError'
import { addFoodSchema, editFoodLogSchema } from '../lib/validations'

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

describe('zodErrorMessage', () => {
  const failure = (schema: { safeParse: (v: unknown) => { success: boolean; error?: unknown } }, payload: unknown) => {
    const r = schema.safeParse(payload)
    expect(r.success).toBe(false)
    return r.error as { issues: { path: (string | number)[]; message: string }[] }
  }

  const validAdd = { food_id: 'e58ed763-928c-4155-bee9-fdbaaadc15f3', meal: 'lunch', servings: 1, grams: 150 }

  it('relays the message we authored, not the serialized issue array', () => {
    const error = failure(addFoodSchema, { ...validAdd, grams: 10001 })
    expect(zodErrorMessage(error)).toBe('Grams cannot exceed 10,000')
    // The regression this exists to stop: ZodError.message is JSON.
    expect(zodErrorMessage(error)).not.toContain('{')
    expect(zodErrorMessage(error)).not.toContain('too_big')
  })

  it('names the field when Zod supplied its own generic message', () => {
    const error = failure(addFoodSchema, { ...validAdd, food_id: '123' })
    expect(zodErrorMessage(error)).toBe('food_id: Invalid uuid')
  })

  it('falls back when there is nothing usable to say', () => {
    expect(zodErrorMessage({ issues: [] }, 'Check the amount and try again.')).toBe('Check the amount and try again.')
    expect(zodErrorMessage({ issues: [{ path: ['grams'], message: '  ' }] })).toBe('Some of that information was invalid.')
  })

  it('produces a readable message for every quantity a log route can reject', () => {
    const cases: unknown[] = [
      { ...validAdd, grams: 0 },
      { ...validAdd, grams: -5 },
      { ...validAdd, grams: NaN },
      { ...validAdd, grams: 10001 },
      { ...validAdd, servings: 100 },
    ]
    for (const payload of cases) {
      const message = zodErrorMessage(failure(addFoodSchema, payload))
      expect(message, JSON.stringify(payload)).not.toContain('"code"')
      expect(message.length, JSON.stringify(payload)).toBeLessThan(80)
    }
  })

  it('covers the edit route the same way', () => {
    const validEdit = {
      id: 'e58ed763-928c-4155-bee9-fdbaaadc15f3', grams: 150, servings: 1,
      meal: 'lunch', kcal: 200, protein_g: 5, carbs_g: 30, fat_g: 4,
    }
    expect(zodErrorMessage(failure(editFoodLogSchema, { ...validEdit, grams: 10001 })))
      .toBe('Grams cannot exceed 10,000')
  })
})
