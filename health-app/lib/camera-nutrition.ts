// Nutrition-resolution logic for the camera AI scan route.
// Lives in lib/ (not the route file) so it can be unit-tested — Next.js
// route files may only export route handlers/config.

export type LabelPanel = {
  panel_amount?: number
  serving_size?: number
  servings_per_pack?: number
  net_quantity?: number
  unit?: string
  energy_kcal?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
}

export type GeminiFood = {
  name: string
  estimated_grams: number
  unit?: string
  kcal_per_100g: number
  protein_g_per_100g: number
  carbs_g_per_100g: number
  fat_g_per_100g: number
  total_kcal?: number
  total_protein_g?: number
  total_carbs_g?: number
  total_fat_g?: number
  label?: LabelPanel | null
}

export type ResolvedNutrition = {
  kcal_per_100g: number
  protein_g_per_100g: number
  carbs_g_per_100g: number
  fat_g_per_100g: number
  portion: number
  unit: string
  fromLabel: boolean
  fromServingTotal: boolean
}

/** Non-negative finite number, or null. Gemini sometimes returns numerals as strings. */
export function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Everything downstream is per-100g/ml, but Indian labels state values per 100g,
 * per serve, or (confusingly) both — "Per 100 ml & Per Serve % RDA" means the
 * nutrients are per 100ml and only the RDA is per serve. Letting the model do
 * this conversion produced wrong numbers repeatedly, so it now only transcribes
 * the panel and the arithmetic happens here, where it's deterministic.
 */
export function resolveNutrition(item: GeminiFood): ResolvedNutrition | null {
  const itemUnit = item.unit === 'ml' || item.unit === 'pcs' ? item.unit : 'g'
  const portion = num(item.estimated_grams) || 100
  const fallback = {
    kcal_per_100g:      num(item.kcal_per_100g) ?? 0,
    protein_g_per_100g: num(item.protein_g_per_100g) ?? 0,
    carbs_g_per_100g:   num(item.carbs_g_per_100g) ?? 0,
    fat_g_per_100g:     num(item.fat_g_per_100g) ?? 0,
    portion,
    unit:               itemUnit,
    fromLabel:          false,
    fromServingTotal:   false,
  }

  // Food logs calculate nutrition from a per-100-unit value. Normalize the
  // supplied total for the exact visible count, so a count is never converted
  // into an estimated gram weight for either display or nutrition math.
  if (itemUnit === 'pcs') {
    const kcal = num(item.total_kcal)
    const protein = num(item.total_protein_g)
    const carbs = num(item.total_carbs_g)
    const fat = num(item.total_fat_g)
    if (kcal !== null && protein !== null && carbs !== null && fat !== null) {
      const scale = 100 / portion
      return {
        kcal_per_100g: kcal * scale,
        protein_g_per_100g: protein * scale,
        carbs_g_per_100g: carbs * scale,
        fat_g_per_100g: fat * scale,
        portion,
        unit: itemUnit,
        fromLabel: false,
        fromServingTotal: true,
      }
    }
    return null
  }

  const label = item.label
  const energy = label ? num(label.energy_kcal) : null
  const panelAmount = label ? num(label.panel_amount) : null
  if (!label || energy === null || !panelAmount) return fallback

  // One formula for every panel shape: a "Per 100 ml" panel has panel_amount=100
  // (scale=1, no-op); a "Per Serving (45g)" panel has panel_amount=45 and scales
  // up. The model never classifies "per-100 vs per-serving" — it just reports
  // the quantity the printed numbers are actually for, which is far less prone
  // to misreading than picking between two abstract categories.
  const scale = 100 / panelAmount
  const kcal100 = energy * scale
  if (!(kcal100 > 0) || kcal100 > 900) return fallback // implausible for any real food

  // Sanity check: energy should roughly match what the macros imply (Atwater
  // factors). A big mismatch means the model likely paired mismatched numbers
  // (e.g. energy from one column, macros from another) — don't trust the panel.
  const protein = num(label.protein_g)
  const carbs = num(label.carbs_g)
  const fat = num(label.fat_g)
  if (protein !== null && carbs !== null && fat !== null) {
    const impliedKcal = protein * 4 + carbs * 4 + fat * 9
    if (impliedKcal > 20 && (energy < impliedKcal * 0.5 || energy > impliedKcal * 1.8)) return fallback
  }

  const servingSize = num(label.serving_size)
  const net = num(label.net_quantity)
  const servings = num(label.servings_per_pack)

  // Single-serve pack → default the portion to the whole pack; otherwise one serving.
  const labelPortion =
    net && (servings === null || servings <= 1) ? net
    : servingSize ? servingSize
    : (num(item.estimated_grams) || 100)

  return {
    kcal_per_100g:      kcal100,
    protein_g_per_100g: (num(label.protein_g) ?? 0) * scale,
    carbs_g_per_100g:   (num(label.carbs_g) ?? 0) * scale,
    fat_g_per_100g:     (num(label.fat_g) ?? 0) * scale,
    portion:            labelPortion,
    unit:               label.unit === 'ml' ? 'ml' : label.unit === 'g' ? 'g' : itemUnit,
    fromLabel:          true,
    fromServingTotal:   false,
  }
}
