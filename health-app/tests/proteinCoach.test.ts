import { describe, it, expect } from 'vitest'
import { proteinCoachLine, PROTEIN_SOURCES } from '../lib/proteinCoach'
import { PROTEIN_G_PER_KG } from '../lib/tdee'

describe('proteinCoachLine', () => {
  it('celebrates and states the g/kg assumption once the target is met', () => {
    const line = proteinCoachLine(110, 104, 65)
    expect(line?.tone).toBe('met')
    expect(line?.text).toContain('110g')
    expect(line?.text).toContain(`${PROTEIN_G_PER_KG}g per kg`)
  })

  it('treats exactly hitting the target as met', () => {
    expect(proteinCoachLine(104, 104, 65)?.tone).toBe('met')
  })

  it('omits the g/kg basis when bodyweight is unknown', () => {
    const line = proteinCoachLine(110, 104, null)
    expect(line?.tone).toBe('met')
    expect(line?.text).not.toContain('per kg')
  })

  it('does not send you to the kitchen over a rounding error', () => {
    const line = proteinCoachLine(100, 104, 65)
    expect(line?.tone).toBe('close')
    expect(line?.text).toContain('4g')
    expect(line?.text).not.toContain('katori')
  })

  it('suggests a concrete household portion for a real gap', () => {
    const line = proteinCoachLine(78, 104, 65) // 26g short
    expect(line?.tone).toBe('gap')
    expect(line?.text).toContain('26g of protein to go')
    // 26g is exactly the soya-chunks portion.
    expect(line?.text).toContain('soya chunks')
  })

  it('picks the closest portion rather than always the biggest', () => {
    const line = proteinCoachLine(95, 104, 65) // 9g short -> a katori of dal
    expect(line?.text).toContain('dal')
  })

  it('always names something the user could plausibly have at home', () => {
    for (let gap = 6; gap <= 60; gap++) {
      const line = proteinCoachLine(0, gap, 65)
      expect(line?.tone).toBe('gap')
      expect(line?.text).toMatch(/curd|dal|egg|paneer|rajma|soya chunks|milk/)
    }
  })

  it('never claims a portion covers a gap it cannot', () => {
    // Before the first meal the gap is the whole target, so this is the line
    // Home shows every morning. Nothing in the table is anywhere near 104g.
    const line = proteinCoachLine(0, 104, 65)
    expect(line?.tone).toBe('gap')
    expect(line?.text).toContain('104g of protein to go')
    expect(line?.text).not.toContain('covers it')
    expect(line?.text).toContain('26g of that')
  })

  it('only claims coverage when the named portion genuinely closes the gap', () => {
    // The invariant the old copy broke: "covers it" must imply enough protein.
    for (let gap = 6; gap <= 130; gap++) {
      const text = proteinCoachLine(0, gap, 65)?.text ?? ''
      if (!text.includes('covers it')) continue
      const named = PROTEIN_SOURCES.find((s) => text.includes(s.portion))
      expect(named).toBeDefined()
      expect(named!.grams).toBeGreaterThanOrEqual(gap)
    }
  })

  it('states a real contribution whenever it cannot claim coverage', () => {
    for (let gap = 6; gap <= 130; gap++) {
      const text = proteinCoachLine(0, gap, 65)?.text ?? ''
      if (text.includes('covers it')) continue
      const named = PROTEIN_SOURCES.find((s) => text.includes(s.portion))
      expect(named).toBeDefined()
      expect(text).toContain(`is ${named!.grams}g of that`)
      expect(named!.grams).toBeLessThan(gap)
    }
  })

  it('returns null when there is no usable target', () => {
    expect(proteinCoachLine(50, 0, 65)).toBeNull()
    expect(proteinCoachLine(50, NaN, 65)).toBeNull()
  })

  it('returns null on nonsense intake rather than rendering a broken line', () => {
    expect(proteinCoachLine(-5, 104, 65)).toBeNull()
    expect(proteinCoachLine(NaN, 104, 65)).toBeNull()
  })
})
