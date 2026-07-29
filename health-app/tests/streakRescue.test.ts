import { describe, it, expect } from 'vitest'
import { istMonthKey, rescuesRemaining, RESCUES_PER_MONTH } from '../lib/streakRescue'

describe('istMonthKey', () => {
  it('reads the month in IST, not UTC', () => {
    // 2026-07-31T19:00:00Z is 00:30 IST on 1 Aug — an August rescue.
    expect(istMonthKey(new Date('2026-07-31T19:00:00Z'))).toBe('2026-08')
    expect(istMonthKey(new Date('2026-07-31T18:00:00Z'))).toBe('2026-07')
  })
})

describe('rescuesRemaining', () => {
  const now = new Date('2026-07-29T06:30:00Z')

  it('gives a full allowance to someone who has never used one', () => {
    expect(rescuesRemaining([], now)).toBe(RESCUES_PER_MONTH)
  })

  it('spends the allowance for the month it was bought in', () => {
    expect(rescuesRemaining(['2026-07-04T10:00:00Z'], now)).toBe(0)
  })

  it('does not count rescues bought in an earlier month', () => {
    expect(rescuesRemaining(['2026-06-28T10:00:00Z'], now)).toBe(RESCUES_PER_MONTH)
  })

  it('never goes negative if history somehow holds more than the cap', () => {
    const spent = ['2026-07-01T10:00:00Z', '2026-07-15T10:00:00Z', '2026-07-20T10:00:00Z']
    expect(rescuesRemaining(spent, now)).toBe(0)
  })

  it('accepts Dates as well as ISO strings', () => {
    expect(rescuesRemaining([new Date('2026-07-04T10:00:00Z')], now)).toBe(0)
  })

  it('counts when it was SPENT, not which day it repaired', () => {
    // A rescue bought on 1 Aug IST that repaired 31 Jul must not refund July's
    // allowance — otherwise a break across a month boundary is free.
    const august = new Date('2026-08-02T06:30:00Z')
    expect(rescuesRemaining(['2026-07-31T19:00:00Z'], august)).toBe(0)
  })
})
