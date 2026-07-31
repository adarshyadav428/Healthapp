// One warm, honest coaching sentence for a just-scanned/described meal —
// HealthifyMe Snap's differentiator, but computed locally from the meal totals
// and the user's targets (no extra AI call). Pure, so it's easy to test.

export type MealTotals = { kcal: number; protein: number }
export type DailyTargets = { kcal: number; protein: number }
/** What the user had ALREADY logged today, before this meal. */
export type ConsumedSoFar = { kcal: number; protein: number }

/**
 * Roughly what a brisk 30-minute walk burns for an average adult. Only used to
 * offer the walk when it would genuinely close the gap — telling someone a walk
 * covers a 600 kcal overage would be a lie, and the entire value of this line is
 * that it can be trusted.
 */
const WALK_30MIN_KCAL = 150

/** Below this, "you have room left" is noise rather than information. */
const MEANINGFUL_REMAINDER = 150

const round10 = (n: number) => Math.round(n / 10) * 10

/**
 * Returns a single encouraging sentence, or null when there isn't enough to say
 * anything useful (no targets, or an empty meal).
 *
 * `consumed` is optional, and it is what makes the sentence honest. Without it
 * the line can only describe the meal as a share of the whole day, which reads
 * as nonsense the moment the user is already over: a 200 kcal snack on top of
 * 1,900 eaten against a 1,600 target used to say "A light 12% of your day —
 * good room left for balanced meals". Pass what's already logged and the line
 * talks about the budget that is actually left.
 *
 * Tone rule, inherited from the rest of the app: being over goal is stated
 * plainly and never shamed — the dashboard shows "X over" in ember, never red.
 * So the over-budget branch reports the number and, only when it is small
 * enough for the claim to be true, offers a concrete way to close it.
 */
export function coachingLine(
  meal: MealTotals,
  targets: DailyTargets,
  consumed?: ConsumedSoFar
): string | null {
  if (!meal || meal.kcal <= 0 || !targets || targets.kcal <= 0) return null

  const proteinShare = targets.protein > 0 ? meal.protein / targets.protein : 0
  const p = Math.round(meal.protein)

  // Lead with protein praise when the meal is protein-dense (>= 30% of the day).
  const proteinBit =
    proteinShare >= 0.3 ? `Solid protein — ${p}g here. ` :
    proteinShare >= 0.15 ? `Nice ${p}g of protein. ` :
    ''

  // No day context: the original meal-vs-target framing. Kept so any caller that
  // genuinely doesn't know the day's totals still gets a sensible sentence.
  if (!consumed) {
    const pct = Math.round((meal.kcal / targets.kcal) * 100)
    const tip =
      pct >= 45 ? `That's about ${pct}% of your day's calories, so keep the next meal light.`
      : pct >= 20 ? `About ${pct}% of your day's calories — right on track.`
      : `A light ${pct}% of your day — good room left for balanced meals.`
    return (proteinBit + tip).trim()
  }

  const remaining = targets.kcal - (consumed.kcal + meal.kcal)

  let tip: string
  if (remaining < 0) {
    const over = round10(-remaining)
    tip =
      over <= WALK_30MIN_KCAL
        ? `That puts you about ${over} kcal over for today — a 30-minute walk would square it.`
        : `That puts you about ${over} kcal over for today. Worth knowing, not worth worrying about — tomorrow starts clean.`
  } else if (remaining < MEANINGFUL_REMAINDER) {
    tip = `That's your day's budget just about spent — roughly ${round10(remaining)} kcal left.`
  } else {
    tip = `That leaves you about ${round10(remaining)} kcal for the rest of today.`
  }

  return (proteinBit + tip).trim()
}
