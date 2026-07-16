/**
 * Shared macro-scaling math for food-log rows.
 *
 * Contract (see EditFoodLogModal / /api/logs/add): a food_logs row stores
 * grams-per-serving plus a servings count, and its kcal/macros are the
 * TOTAL for grams × servings.
 */

export type Per100Macros = {
  kcal_per_100g: number
  protein_g_per_100g: number
  carbs_g_per_100g: number
  fat_g_per_100g: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function scaleMacros(food: Per100Macros, grams: number, servings = 1): {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
} {
  const factor = (grams / 100) * servings
  return {
    kcal:      round2(food.kcal_per_100g * factor),
    protein_g: round2(food.protein_g_per_100g * factor),
    carbs_g:   round2(food.carbs_g_per_100g * factor),
    fat_g:     round2(food.fat_g_per_100g * factor),
  }
}
