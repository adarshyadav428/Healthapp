/**
 * Meal-of-day inference — single source of truth for "which meal is it right
 * now?" when logging without an explicit meal choice. Extracted from the six
 * copies that had drifted apart (CameraModal / QuickAddModal / AddFoodModal /
 * FoodLanding / FoodSearch all used this <11/<16/<21 rule).
 *
 * NOTE: ChatLogModal's inferMeal historically used a <20 dinner cutoff, not
 * <21 — that discrepancy is intentionally NOT collapsed here so this stays a
 * behaviour-preserving refactor. Pure so it's unit-testable (tests/meal.test.ts).
 */

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export function mealForTime(date: Date = new Date()): Meal {
  const h = date.getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}
