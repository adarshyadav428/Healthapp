import { describe, it, expect } from 'vitest'
import { coachingLine } from '../lib/coaching'

const targets = { kcal: 2000, protein: 120 }

describe('coachingLine', () => {
  it('returns null without usable meal or targets', () => {
    expect(coachingLine({ kcal: 0, protein: 0 }, targets)).toBeNull()
    expect(coachingLine({ kcal: 500, protein: 30 }, { kcal: 0, protein: 0 })).toBeNull()
  })

  it('praises a protein-dense meal', () => {
    // 40g protein = 33% of 120g target → protein praise
    const line = coachingLine({ kcal: 500, protein: 40 }, targets)
    expect(line).toContain('40g')
    expect(line).toMatch(/protein/i)
  })

  it('warns to keep the next meal light for a big meal', () => {
    // 1000 kcal = 50% of the day
    const line = coachingLine({ kcal: 1000, protein: 20 }, targets)
    expect(line).toMatch(/50%/)
    expect(line).toMatch(/light/i)
  })

  it('reassures on a light meal', () => {
    const line = coachingLine({ kcal: 200, protein: 5 }, targets)
    expect(line).toMatch(/10%/)
  })
})
