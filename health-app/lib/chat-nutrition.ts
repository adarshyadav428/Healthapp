// Nutrition-resolution logic for the chat AI logging route. Mirrors
// lib/camera-nutrition.ts, which solved the identical problem for photo
// scans: reuse its plausibility guardrails rather than re-implement them, so
// the two AI paths agree on what "physically impossible" means.
//
// The chat route (app/api/chat/analyze/route.ts) previously trusted Gemini's
// kcal_per_100g/macros verbatim — no clamp, no Atwater check, nothing. A
// hallucinated value (e.g. 900 kcal/100g dal) was written straight into the
// shared `foods` table as a permanent `estimate` row. This file closes that
// gap for the freeform per-100g estimate shape chat always uses (chat has no
// label panel and no "pcs" input, unlike camera).

import { isPlausible, clampToPlausible, num } from './camera-nutrition'

export type ChatItem = {
  name: string
  portion_desc: string
  grams: number
  confidence?: 'low' | 'medium' | 'high'
  kcal_per_100g: number
  protein_g_per_100g: number
  carbs_g_per_100g: number
  fat_g_per_100g: number
}

export type ResolvedNutrition = {
  kcal_per_100g: number
  protein_g_per_100g: number
  carbs_g_per_100g: number
  fat_g_per_100g: number
  /** False when the raw values failed isPlausible and were clamped. */
  plausible: boolean
}

/**
 * The chat analogue of camera-nutrition's resolveNutrition, minus label/pcs
 * handling — chat's model output is always a freeform per-100g estimate.
 * Clamps rather than trusts an implausible value outright, same as camera.
 */
export function resolveChatItemNutrition(item: ChatItem): ResolvedNutrition {
  const kcal = num(item.kcal_per_100g) ?? 0
  const protein = num(item.protein_g_per_100g) ?? 0
  const carbs = num(item.carbs_g_per_100g) ?? 0
  const fat = num(item.fat_g_per_100g) ?? 0
  const plausible = isPlausible(kcal, protein, carbs, fat)
  if (plausible) {
    return { kcal_per_100g: kcal, protein_g_per_100g: protein, carbs_g_per_100g: carbs, fat_g_per_100g: fat, plausible: true }
  }
  return { ...clampToPlausible(protein, carbs, fat), plausible: false }
}
