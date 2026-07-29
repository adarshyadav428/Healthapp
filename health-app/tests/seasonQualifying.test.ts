import { describe, it, expect } from 'vitest'
import { qualifyingDays } from '../lib/seasonQualifying'

const at = (day: string, protein = 0) => ({ logged_at: `${day}T06:30:00Z`, protein_g: protein })
const weigh = (day: string) => ({ measured_at: `${day}T06:30:00Z` })

const base = { foodLogs: [], weighIns: [], proteinTargetG: 100 }

describe('qualifyingDays — consistency', () => {
  it('counts each logged IST day once, however many meals it holds', () => {
    const days = qualifyingDays('consistency', {
      ...base, foodLogs: [at('2026-08-01'), at('2026-08-01'), at('2026-08-02')],
    })
    expect(days.sort()).toEqual(['2026-08-01', '2026-08-02'])
  })

  it('is empty for someone who logged nothing', () => {
    expect(qualifyingDays('consistency', base)).toEqual([])
  })

  it('reads the day in IST, not UTC', () => {
    // 19:00Z is 00:30 IST the next day.
    const days = qualifyingDays('consistency', {
      ...base, foodLogs: [{ logged_at: '2026-08-01T19:00:00Z' }],
    })
    expect(days).toEqual(['2026-08-02'])
  })
})

describe('qualifyingDays — protein', () => {
  it('sums the whole day before judging it', () => {
    // Three modest meals clear 100 g together, none does alone.
    const days = qualifyingDays('protein', {
      ...base, foodLogs: [at('2026-08-01', 40), at('2026-08-01', 35), at('2026-08-01', 30)],
    })
    expect(days).toEqual(['2026-08-01'])
  })

  it('excludes a day that fell short', () => {
    expect(qualifyingDays('protein', { ...base, foodLogs: [at('2026-08-01', 80)] })).toEqual([])
  })

  it('counts a day that lands exactly on target', () => {
    expect(qualifyingDays('protein', { ...base, foodLogs: [at('2026-08-01', 100)] })).toEqual(['2026-08-01'])
  })

  it('qualifies nothing without a target rather than qualifying everything', () => {
    for (const proteinTargetG of [null, 0]) {
      expect(qualifyingDays('protein', { ...base, proteinTargetG, foodLogs: [at('2026-08-01', 200)] }))
        .toEqual([])
    }
  })

  it('treats a log with no protein field as zero, not NaN', () => {
    const days = qualifyingDays('protein', {
      ...base, proteinTargetG: 10, foodLogs: [{ logged_at: '2026-08-01T06:30:00Z' }, at('2026-08-01', 12)],
    })
    expect(days).toEqual(['2026-08-01'])
  })
})

describe('qualifyingDays — weigh_in', () => {
  it('counts each day with a weigh-in once', () => {
    const days = qualifyingDays('weigh_in', {
      ...base, weighIns: [weigh('2026-08-01'), weigh('2026-08-01'), weigh('2026-08-03')],
    })
    expect(days.sort()).toEqual(['2026-08-01', '2026-08-03'])
  })

  it('ignores food logs entirely', () => {
    expect(qualifyingDays('weigh_in', { ...base, foodLogs: [at('2026-08-01', 200)] })).toEqual([])
  })
})
