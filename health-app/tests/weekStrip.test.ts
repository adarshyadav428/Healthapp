import { describe, it, expect } from 'vitest'
import { buildWeekStrip } from '../lib/weekStrip'

// 2026-08-27 18:34 UTC = 00:04 IST on Fri 2026-08-28 — the post-IST-midnight,
// pre-UTC-midnight window where the strip used to lag a day behind the header.
const AFTER_IST_MIDNIGHT = new Date('2026-08-27T18:34:00Z')
// 2026-08-28 09:00 UTC = 14:30 IST Fri 2026-08-28 — UTC and IST agree here.
const MIDDAY = new Date('2026-08-28T09:00:00Z')

describe('buildWeekStrip', () => {
  it('ends on the current IST day just after IST midnight (not the UTC day)', () => {
    const days = buildWeekStrip([], AFTER_IST_MIDNIGHT)
    const last = days[days.length - 1]
    expect(last.key).toBe('2026-08-28')
    expect(last.dayNum).toBe(28)
    expect(last.letter).toBe('F')
    expect(last.isToday).toBe(true)
  })

  it('marks exactly one chip as today', () => {
    for (const now of [AFTER_IST_MIDNIGHT, MIDDAY]) {
      expect(buildWeekStrip([], now).filter((d) => d.isToday)).toHaveLength(1)
    }
  })

  it('covers 7 consecutive IST days, oldest first', () => {
    const days = buildWeekStrip([], AFTER_IST_MIDNIGHT)
    expect(days.map((d) => d.key)).toEqual([
      '2026-08-22', '2026-08-23', '2026-08-24', '2026-08-25',
      '2026-08-26', '2026-08-27', '2026-08-28',
    ])
  })

  it('is stable across the UTC-midnight boundary within one IST day', () => {
    const before = buildWeekStrip([], new Date('2026-08-27T23:59:00Z')) // 05:29 IST Aug 28
    const after = buildWeekStrip([], new Date('2026-08-28T00:01:00Z')) // 05:31 IST Aug 28
    expect(before.map((d) => d.key)).toEqual(after.map((d) => d.key))
  })

  it('lands the dot on the IST day the server filed the log under', () => {
    // Server sends IST keys; a 00:04-IST log belongs to Aug 28, not Aug 27.
    const days = buildWeekStrip(['2026-08-28'], AFTER_IST_MIDNIGHT)
    expect(days.find((d) => d.key === '2026-08-28')?.hasLog).toBe(true)
    expect(days.find((d) => d.key === '2026-08-27')?.hasLog).toBe(false)
  })

  it('derives letter and number from the key the chip links to', () => {
    for (const d of buildWeekStrip([], MIDDAY)) {
      const [, , dd] = d.key.split('-').map(Number)
      expect(d.dayNum).toBe(dd)
    }
  })
})
