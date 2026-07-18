import { describe, it, expect } from 'vitest'
import { mealForTime } from '../lib/meal'

const at = (hour: number) => new Date(2026, 0, 1, hour, 0, 0)

describe('mealForTime()', () => {
  it('returns breakfast before 11:00', () => {
    expect(mealForTime(at(0))).toBe('breakfast')
    expect(mealForTime(at(7))).toBe('breakfast')
    expect(mealForTime(at(10))).toBe('breakfast')
  })

  it('returns lunch from 11:00 up to 16:00', () => {
    expect(mealForTime(at(11))).toBe('lunch')
    expect(mealForTime(at(13))).toBe('lunch')
    expect(mealForTime(at(15))).toBe('lunch')
  })

  it('returns dinner from 16:00 up to 21:00', () => {
    expect(mealForTime(at(16))).toBe('dinner')
    expect(mealForTime(at(19))).toBe('dinner')
    expect(mealForTime(at(20))).toBe('dinner')
  })

  it('returns snack from 21:00 onwards', () => {
    expect(mealForTime(at(21))).toBe('snack')
    expect(mealForTime(at(23))).toBe('snack')
  })
})
