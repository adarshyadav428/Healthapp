type MacroProfile = {
  name: string
  kcal_per_100g: number
  protein_g_per_100g: number
  carbs_g_per_100g: number
  fat_g_per_100g: number
  fiber_g_per_100g: number | null
}

/**
 * schema.org structured data for a /foods/[slug] page.
 *
 * Modelled as a `Product` with a `nutrition` block, NOT `Recipe` — Google's
 * `NutritionInformation` rich result is only supported nested inside `Recipe`,
 * and an IFCT food row is not a recipe. Claiming it is would be a false type
 * for a rich result that may not even render. `Product` + a `nutrition`
 * `NutritionInformation` is valid, honest, and still machine-readable.
 */
export function buildFoodJsonLd(
  food: MacroProfile & { brand?: string | null },
): Record<string, unknown> {
  const round = (n: number) => Math.round(n)
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: food.name,
    category: 'Food',
    ...(food.brand ? { brand: { '@type': 'Brand', name: food.brand } } : {}),
    description: generateFoodSummary(food),
    nutrition: {
      '@type': 'NutritionInformation',
      servingSize: '100 g',
      calories: `${round(food.kcal_per_100g)} kcal`,
      proteinContent: `${round(food.protein_g_per_100g)} g`,
      carbohydrateContent: `${round(food.carbs_g_per_100g)} g`,
      fatContent: `${round(food.fat_g_per_100g)} g`,
      ...(food.fiber_g_per_100g != null
        ? { fiberContent: `${round(food.fiber_g_per_100g)} g` }
        : {}),
    },
  }
}

/**
 * Templated (not hand-written) summary paragraph — genuinely differentiated
 * per food since it's driven by that food's actual macro numbers, not a
 * fixed sentence. Feasible at 400+ pages without either duplicate-feeling
 * content or per-food copywriting.
 */
export function generateFoodSummary(food: MacroProfile): string {
  const kcal = Math.round(food.kcal_per_100g)
  const parts = [
    `${food.name} has ${kcal} kcal per 100g, with ${food.protein_g_per_100g}g protein, ${food.carbs_g_per_100g}g carbs, and ${food.fat_g_per_100g}g fat.`,
  ]

  if (food.protein_g_per_100g >= 15) parts.push("It's a strong source of protein.")
  else if (food.protein_g_per_100g >= 8) parts.push('It offers a moderate amount of protein.')

  if (food.fiber_g_per_100g != null && food.fiber_g_per_100g >= 5) {
    parts.push('It\'s also high in fiber, which helps with satiety.')
  }

  return parts.join(' ')
}

/** "Is X good for weight loss?" — the brief's own example framing, answered from real macro thresholds. */
export function generateWeightLossVerdict(food: MacroProfile): string {
  const isLight = food.kcal_per_100g <= 150
  const isProteinRich = food.protein_g_per_100g >= 10

  if (isLight && isProteinRich) {
    return `Yes — ${food.name} is both low in calories and relatively high in protein, making it a solid choice if you're in a calorie deficit.`
  }
  if (isLight) {
    return `${food.name} is relatively low in calories per 100g, so it can fit well into a weight-loss plan in reasonable portions.`
  }
  if (isProteinRich) {
    return `${food.name} is calorie-dense, but its protein content can help with satiety — just watch your portion size if you're cutting.`
  }
  return `${food.name} is fairly calorie-dense with lower protein, so portion control matters if you're trying to lose weight — pair it with lighter, protein-rich sides.`
}
