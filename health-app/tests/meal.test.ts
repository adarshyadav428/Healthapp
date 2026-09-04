import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mealForTime, MEAL_WINDOWS } from '../lib/meal'

/**
 * An instant whose **IST** hour is `hour`.
 *
 * This was `new Date(2026, 0, 1, hour, 0, 0)` — a *local* Date — back when
 * `mealForTime` read `getHours()`. Both halves moved in step, so the suite was
 * green on any machine while asserting nothing about which clock the app uses.
 * It would now pass on Adarsh's IST laptop and fail on a UTC CI runner, which
 * is the tell: a test that depends on the machine it runs on was never testing
 * the timezone at all (audit 2026-09-03, P2-5).
 */
const at = (hour: number) => new Date(`2026-01-01T${String(hour).padStart(2, '0')}:00:00+05:30`)

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

  /**
   * The windows are IST hours, not the runtime's. The app files the log on an
   * IST day; if the meal came from a different clock, one row was decided by
   * two clocks — and near a boundary they disagree by a whole meal.
   */
  it('reads the IST hour, not the runtime hour', () => {
    // 15:30 UTC is 21:00 IST — dinner. A runtime on UTC would call it snack,
    // and one in New York (10:30) would call it lunch.
    expect(mealForTime(new Date('2026-01-01T15:30:00Z'))).toBe('dinner')
    // 19:30 UTC is 01:00 IST the next day — breakfast, the late-night window.
    expect(mealForTime(new Date('2026-01-01T19:30:00Z'))).toBe('breakfast')
    // 05:00 UTC is 10:30 IST — still breakfast; UTC would say breakfast too,
    // so this one is here to prove the shift doesn't over-rotate.
    expect(mealForTime(new Date('2026-01-01T05:00:00Z'))).toBe('breakfast')
  })
})

/**
 * `useChatLog` carried a seventh copy of this rule that disagreed with it in
 * both directions, behind a fallback that only fires when the model returns no
 * meal — so nothing here would have caught it. Asserted against the source
 * because the defect was the *existence* of the second implementation.
 */
describe('no surface re-implements meal inference', () => {
  const chatLog = readFileSync(join(__dirname, '..', 'hooks', 'useChatLog.ts'), 'utf8')

  it('useChatLog falls back to mealForTime', () => {
    expect(chatLog).toMatch(/data\.meal\?\.toLowerCase\(\) \?\? mealForTime\(\)/)
  })

  it('useChatLog defines no meal windows of its own', () => {
    // The old copy: `if (h < 11) return 'breakfast'` and friends.
    expect(chatLog).not.toMatch(/return\s+'breakfast'/)
    expect(chatLog).not.toMatch(/getHours\(\)/)
  })
})
