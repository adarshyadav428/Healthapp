import { describe, it, expect } from 'vitest'
import { ftInToCm } from '../lib/units'

describe('ftInToCm', () => {
  it('converts whole feet', () => {
    expect(ftInToCm(5, 0)).toBe(152) // 60 in * 2.54 = 152.4 → 152
    expect(ftInToCm(6, 0)).toBe(183) // 72 in * 2.54 = 182.88 → 183
  })

  it('converts feet + inches', () => {
    expect(ftInToCm(5, 7)).toBe(170) // 67 in * 2.54 = 170.18 → 170
    expect(ftInToCm(5, 11)).toBe(180) // 71 in * 2.54 = 180.34 → 180
  })

  it('handles zero', () => {
    expect(ftInToCm(0, 0)).toBe(0)
  })
})
