import { describe, it, expect } from 'vitest'
import { mealForTime, MEAL_WINDOWS } from '../lib/meal'

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

  // Changed deliberately in v2: 16:00–19:00 used to infer dinner, which filed
  // evening chai-and-snack under the dinner section.
  it('returns snack from 16:00 up to 19:00', () => {
    expect(mealForTime(at(16))).toBe('snack')
    expect(mealForTime(at(17))).toBe('snack')
    expect(mealForTime(at(18))).toBe('snack')
  })

  it('returns dinner from 19:00 onwards, including late night', () => {
    expect(mealForTime(at(19))).toBe('dinner')
    expect(mealForTime(at(21))).toBe('dinner')
    expect(mealForTime(at(23))).toBe('dinner')
  })

  it('every hour of the day maps to exactly one meal', () => {
    for (let h = 0; h < 24; h++) {
      expect(['breakfast', 'lunch', 'dinner', 'snack']).toContain(mealForTime(at(h)))
    }
  })

  it('boundaries line up with the exported windows', () => {
    expect(mealForTime(at(MEAL_WINDOWS.breakfastUntil - 1))).toBe('breakfast')
    expect(mealForTime(at(MEAL_WINDOWS.breakfastUntil))).toBe('lunch')
    expect(mealForTime(at(MEAL_WINDOWS.lunchUntil))).toBe('snack')
    expect(mealForTime(at(MEAL_WINDOWS.snackUntil))).toBe('dinner')
  })
})
