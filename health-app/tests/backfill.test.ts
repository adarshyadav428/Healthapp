import { describe, it, expect } from 'vitest'
import { isWithinFreeLogWindow, resolveLoggedAt, resolveLoggedAtForRequest } from '../lib/backfill'
import { istDateStr } from '../lib/dateUtils'

// A fixed "now": 2026-07-17 08:00 UTC = 13:30 IST Jul 17.
const NOW = new Date('2026-07-17T08:00:00Z')

describe('isWithinFreeLogWindow', () => {
  it('allows today and the six prior IST days (7-day window)', () => {
    expect(isWithinFreeLogWindow('2026-07-17', NOW)).toBe(true) // today
    expect(isWithinFreeLogWindow('2026-07-11', NOW)).toBe(true) // day 7
  })

  it('rejects the day just outside the window and any future day', () => {
    expect(isWithinFreeLogWindow('2026-07-10', NOW)).toBe(false) // day 8
    expect(isWithinFreeLogWindow('2026-07-18', NOW)).toBe(false) // future
  })
})

describe('resolveLoggedAt', () => {
  it('uses the real instant for no date or today', () => {
    expect(resolveLoggedAt(undefined, NOW)).toBe(NOW.toISOString())
    expect(resolveLoggedAt(istDateStr(NOW), NOW)).toBe(NOW.toISOString())
  })

  it('pins a past IST day to noon IST (06:30 UTC), safely inside that IST day', () => {
    // noon IST Jul 15 = 06:30 UTC Jul 15
    expect(resolveLoggedAt('2026-07-15', NOW)).toBe('2026-07-15T06:30:00.000Z')
    // and its IST calendar date reads back as the same day
    expect(istDateStr(new Date(resolveLoggedAt('2026-07-15', NOW)))).toBe('2026-07-15')
  })
})

/**
 * 2026-09-05 adversarial-audit F2. The subscription/profile Promise.all used
 * to drop both errors — a failed subscriptions read left `isPro` silently
 * `false`, which applied the free-tier backfill window to a real Pro user
 * with no indication anything went wrong. It must now fail the whole
 * backfill decision explicitly instead.
 */
describe('resolveLoggedAtForRequest — subscription read failure', () => {
  function supabaseWith(subResult: { data: unknown; error: unknown }) {
    return {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve(
                table === 'subscriptions' ? subResult : { data: { created_at: '2020-01-01T00:00:00Z' }, error: null }
              ),
          }),
        }),
      }),
    } as never
  }

  it('returns a 500 failure, never silently applying the free-tier window, when the subscription read fails', async () => {
    const sb = supabaseWith({ data: null, error: { message: 'connection reset' } })
    const result = await resolveLoggedAtForRequest(sb, 'user-1', '2026-01-01', NOW)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(500)
  })

  it('still resolves normally for a Pro user when the read succeeds', async () => {
    const sb = supabaseWith({ data: { status: 'active' }, error: null })
    const result = await resolveLoggedAtForRequest(sb, 'user-1', '2020-06-01', NOW)
    expect(result.ok).toBe(true)
  })
})
