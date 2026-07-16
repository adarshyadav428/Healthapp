import { describe, it, expect } from 'vitest'
import { getIstDayRange, getUtcDayRange } from '../lib/dateUtils'

describe('getIstDayRange', () => {
  it('brackets the IST calendar day (IST midnight = 18:30 UTC previous day)', () => {
    // 2026-07-16 10:00 UTC = 15:30 IST → IST day Jul 16
    const { start, end } = getIstDayRange(new Date('2026-07-16T10:00:00Z'))
    expect(start).toBe('2026-07-15T18:30:00.000Z')
    expect(end).toBe('2026-07-16T18:30:00.000Z')
  })

  it('rolls to the next IST day right after IST midnight, before UTC midnight', () => {
    // 2026-07-16 19:00 UTC = 00:30 IST Jul 17
    const { start, end } = getIstDayRange(new Date('2026-07-16T19:00:00Z'))
    expect(start).toBe('2026-07-16T18:30:00.000Z')
    expect(end).toBe('2026-07-17T18:30:00.000Z')
  })

  it('"yesterday" via now − 24h lands on the previous IST day (copy-yesterday fix)', () => {
    const now = new Date('2026-07-16T20:30:00Z') // 02:00 IST Jul 17
    const y = getIstDayRange(new Date(now.getTime() - 24 * 60 * 60 * 1000))
    // user's "yesterday" is IST Jul 16
    expect(y.start).toBe('2026-07-15T18:30:00.000Z')
    expect(y.end).toBe('2026-07-16T18:30:00.000Z')
  })
})

describe('getUtcDayRange', () => {
  it('brackets the UTC calendar day', () => {
    const { start, end } = getUtcDayRange(new Date('2026-07-16T10:00:00Z'))
    expect(start).toBe('2026-07-16T00:00:00.000Z')
    expect(end).toBe('2026-07-17T00:00:00.000Z')
  })
})
