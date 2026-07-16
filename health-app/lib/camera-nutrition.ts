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
  plausible: boolean
}

/** Non-negative finite number, or null. Gemini sometimes returns numerals as strings. */
export function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Plausibility guardrail shared by the per-100g/ml resolution paths (label,
 * freeform per-100g estimate): stated macros can't exceed the food's own
 * mass, and stated energy must roughly agree with what those macros imply
 * via Atwater factors (4/4/9 kcal/g). A hallucinated field (e.g. carbs
 * several times the food's own weight) fails at least one of these checks.
 * NOTE: these thresholds are per-100g/ml — they do not transfer to the
 * per-100-pieces rates the pcs path produces (see resolveNutrition).
 */
export function isPlausible(kcal100: number, protein100: number, carbs100: number, fat100: number): boolean {
  if (!(kcal100 > 0) || kcal100 > 900) return false // implausible for any real food
  if (protein100 + carbs100 + fat100 > 105) return false // macros can't exceed ~100g per 100g/ml (small rounding slack)
  const impliedKcal = protein100 * 4 + carbs100 * 4 + fat100 * 9
  if (impliedKcal > 20 && (kcal100 < impliedKcal * 0.5 || kcal100 > impliedKcal * 1.8)) return false
  return true
}

/**
 * When Gemini's own numbers fail isPlausible and there's no printed label to
 * fall back to, clamp rather than display a physically-impossible value:
 * scale macros down to fit 100g/ml, then recompute kcal from those clamped
 * macros so the two figures can't contradict each other.
 */
export function clampToPlausible(protein100: number, carbs100: number, fat100: number) {
  let protein = Math.max(0, protein100)
  let carbs = Math.max(0, carbs100)
  let fat = Math.max(0, fat100)
  const macroSum = protein + carbs + fat
  if (macroSum > 100) {
    const s = 100 / macroSum
    protein *= s
    carbs *= s
    fat *= s
  }
  const kcal = Math.min(900, protein * 4 + carbs * 4 + fat * 9)
  return { kcal_per_100g: kcal, protein_g_per_100g: protein, carbs_g_per_100g: carbs, fat_g_per_100g: fat }
}

/**
 * Recovers the piece count a DB row's serving_description represents (e.g.
 * "5 pieces (150g)" -> 5), so a per-100g row can be converted to a
 * per-100-pieces rate for "pcs"-unit items. Defaults to 1 — every seeded
 * piece-based row (007_seed_indian_foods.sql, 013_restaurant_foods.sql)
 * follows the "N piece(s) (...)" format.
 */
export function piecesInServing(desc: string | null | undefined): number {
  const m = desc?.match(/^(\d+)\s*pieces?\b/i)
  return m ? Number(m[1]) : 1
}

/**
 * Everything downstream is per-100g/ml, but Indian labels state values per 100g,
 * per serve, or (confusingly) both — "Per 100 ml & Per Serve % RDA" means the
 * nutrients are per 100ml and only the RDA is per serve. Letting the model do
 * this conversion produced wrong numbers repeatedly, so it now only transcribes
 * the panel and the arithmetic happens here, where it's deterministic.
 */
export function resolveNutrition(item: GeminiFood): ResolvedNutrition {
  const itemUnit = item.unit === 'ml' || item.unit === 'pcs' ? item.unit : 'g'
  const portion = num(item.estimated_grams) || 100
  const rawKcal = num(item.kcal_per_100g) ?? 0
  const rawProtein = num(item.protein_g_per_100g) ?? 0
  const rawCarbs = num(item.carbs_g_per_100g) ?? 0
  const rawFat = num(item.fat_g_per_100g) ?? 0
  const rawPlausible = isPlausible(rawKcal, rawProtein, rawCarbs, rawFat)
  // Freeform estimate has no label to fall back to — clamp rather than trust
  // an implausible value outright (see isPlausible/clampToPlausible above).
  const fallback = {
    ...(rawPlausible
      ? { kcal_per_100g: rawKcal, protein_g_per_100g: rawProtein, carbs_g_per_100g: rawCarbs, fat_g_per_100g: rawFat }
      : clampToPlausible(rawProtein, rawCarbs, rawFat)),
    portion,
    unit:               itemUnit,
    fromLabel:          false,
    fromServingTotal:   false,
    plausible:          rawPlausible,
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
      // The per-100g isPlausible thresholds don't apply to a per-100-pieces
      // rate (6 wings × 90 kcal is a legitimate 9000 kcal/100pcs), so guard
      // with the checks that ARE scale-free: energy must agree with the
      // macros' Atwater energy on the totals themselves, and no single piece
      // can carry more energy than the densest real food (~900 kcal). A
      // hallucinated total (e.g. energy from the whole bucket paired with
      // macros for one wing) fails the Atwater check the way a misread
      // label would.
      const impliedKcal = protein * 4 + carbs * 4 + fat * 9
      const atwaterOk = impliedKcal <= 20 || (kcal >= impliedKcal * 0.5 && kcal <= impliedKcal * 1.8)
      const perPieceOk = kcal > 0 && kcal / portion <= 900
      if (atwaterOk && perPieceOk) {
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
          plausible: true,
        }
      }
    }
    // Dropping a visibly-present food is worse than a clamped estimate — let
    // it fall through to the DB-match/estimate path below like any other item.
    return fallback
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
  const protein100 = (num(label.protein_g) ?? 0) * scale
  const carbs100 = (num(label.carbs_g) ?? 0) * scale
  const fat100 = (num(label.fat_g) ?? 0) * scale
  // Sanity check: energy should roughly match what the macros imply (Atwater
  // factors), and the macros shouldn't exceed the food's own mass. A big
  // mismatch means the model likely paired mismatched numbers (e.g. energy
  // from one column, macros from another) — don't trust the panel.
  if (!isPlausible(kcal100, protein100, carbs100, fat100)) return fallback

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
    protein_g_per_100g: protein100,
    carbs_g_per_100g:   carbs100,
    fat_g_per_100g:     fat100,
    portion:            labelPortion,
    unit:               label.unit === 'ml' ? 'ml' : label.unit === 'g' ? 'g' : itemUnit,
    fromLabel:          true,
    fromServingTotal:   false,
    plausible:          true,
  }
}
