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

export type ScaledMacros = {
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
}

/**
 * Unrounded per-portion macros. Callers that need their own rounding (e.g. the
 * camera preview rounds to whole numbers with a single Math.round) use this so
 * they don't double-round through scaleMacros' 2dp storage contract.
 */
export function scaleMacrosRaw(food: Per100Macros, grams: number, servings = 1): ScaledMacros {
  const factor = (grams / 100) * servings
  return {
    kcal:      food.kcal_per_100g * factor,
    protein_g: food.protein_g_per_100g * factor,
    carbs_g:   food.carbs_g_per_100g * factor,
    fat_g:     food.fat_g_per_100g * factor,
  }
}

export function scaleMacros(food: Per100Macros, grams: number, servings = 1): ScaledMacros {
  const raw = scaleMacrosRaw(food, grams, servings)
  return {
    kcal:      round2(raw.kcal),
    protein_g: round2(raw.protein_g),
    carbs_g:   round2(raw.carbs_g),
    fat_g:     round2(raw.fat_g),
  }
}
