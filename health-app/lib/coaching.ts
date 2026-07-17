// One warm, honest coaching sentence for a just-scanned/described meal —
// HealthifyMe Snap's differentiator, but computed locally from the meal totals
// and the user's targets (no extra AI call). Pure, so it's easy to test.

export type MealTotals = { kcal: number; protein: number }
export type DailyTargets = { kcal: number; protein: number }

/**
 * Returns a single encouraging sentence, or null when there isn't enough to say
 * anything useful (no targets, or an empty meal).
 */
export function coachingLine(meal: MealTotals, targets: DailyTargets): string | null {
  if (!meal || meal.kcal <= 0 || !targets || targets.kcal <= 0) return null

  const pct = Math.round((meal.kcal / targets.kcal) * 100)
  const proteinShare = targets.protein > 0 ? meal.protein / targets.protein : 0
  const p = Math.round(meal.protein)

  // Lead with protein praise when the meal is protein-dense (>= 30% of the day).
  const proteinBit =
    proteinShare >= 0.3 ? `Solid protein — ${p}g here. ` :
    proteinShare >= 0.15 ? `Nice ${p}g of protein. ` :
    ''

  let tip: string
  if (pct >= 45) tip = `That's about ${pct}% of your day's calories, so keep the next meal light.`
  else if (pct >= 20) tip = `About ${pct}% of your day's calories — right on track.`
  else tip = `A light ${pct}% of your day — good room left for balanced meals.`

  return (proteinBit + tip).trim()
}
