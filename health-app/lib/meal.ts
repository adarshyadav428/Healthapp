/**
 * Meal-of-day inference — single source of truth for "which meal is it right
 * now?" when logging without an explicit meal choice, and for which meal
 * section the Food screen focuses. Extracted from the six copies that had
 * drifted apart (CameraModal / QuickAddModal / AddFoodModal / FoodLanding /
 * FoodSearch all used a <11/<16/<21 rule).
 *
 * The 16:00–19:00 window is snack, not dinner: evening chai-and-snack is a real
 * Indian eating occasion, and the old rule filed it under dinner — which then
 * made the actual dinner log land in a section that already looked full. Late
 * night stays dinner rather than flipping back to snack, because someone
 * logging at 23:00 is far more often logging a late dinner than a nibble.
 *
 * Pure so it's unit-testable (tests/meal.test.ts).
 */

import { istHour } from './dateUtils'

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

/**
 * Hour-of-day boundaries for meal inference, in **IST**. One constant so
 * inference and the Food screen's time-aware focus can never disagree.
 *
 * These read the IST hour, not the runtime's. They said "local time" until
 * 2026-09-04, which meant the meal a log was filed under came from the device's
 * clock while the *day* it was filed on came from IST — two clocks deciding one
 * row. On any device outside IST those disagree, and near the boundary they
 * disagree by a whole meal.
 */
export const MEAL_WINDOWS = {
  /** Before this hour → breakfast. */
  breakfastUntil: 11,
  /** breakfastUntil–lunchUntil → lunch. */
  lunchUntil: 16,
  /** lunchUntil–snackUntil → snack; at or after snackUntil → dinner. */
  snackUntil: 19,
} as const

export function mealForTime(date: Date = new Date()): Meal {
  const h = istHour(date)
  if (h < MEAL_WINDOWS.breakfastUntil) return 'breakfast'
  if (h < MEAL_WINDOWS.lunchUntil) return 'lunch'
  if (h < MEAL_WINDOWS.snackUntil) return 'snack'
  return 'dinner'
}
