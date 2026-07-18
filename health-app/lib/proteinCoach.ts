/**
 * The daily protein-gap line on Home.
 *
 * Rule-based and free for everyone — no AI call, no Pro gate. Protein is the
 * macro Indian vegetarian diets most often miss, and a number alone ("62 / 104g")
 * doesn't tell anyone what to actually eat. This turns the gap into one concrete
 * suggestion, priced in foods people already have at home.
 *
 * Pure so it's unit-testable (tests/proteinCoach.test.ts).
 */

import { PROTEIN_G_PER_KG } from './tdee'

export type ProteinCoachLine = {
  /** The sentence to render. */
  text: string
  /** 'met' once the target is reached — callers may style it as a win. */
  tone: 'met' | 'close' | 'gap'
}

/**
 * Everyday Indian protein sources with roughly how much protein one common
 * household portion delivers. Deliberately staples, not supplements: a
 * suggestion you have to shop for is a suggestion you ignore.
 */
const SOURCES: { name: string; grams: number; portion: string }[] = [
  { name: 'curd',         grams: 11, portion: 'a bowl of curd' },
  { name: 'dal',          grams: 9,  portion: 'a katori of dal' },
  { name: 'egg',          grams: 6,  portion: 'an egg' },
  { name: 'paneer',       grams: 14, portion: '50g of paneer' },
  { name: 'rajma',        grams: 15, portion: 'a katori of rajma' },
  { name: 'soya chunks',  grams: 26, portion: '50g of soya chunks' },
  { name: 'milk',         grams: 8,  portion: 'a glass of milk' },
]

/** The single source that most nearly closes `gap` without wild overshoot. */
function bestSuggestion(gap: number): { portion: string; grams: number } {
  let best = SOURCES[0]
  let bestDistance = Infinity
  for (const s of SOURCES) {
    const distance = Math.abs(s.grams - gap)
    if (distance < bestDistance) {
      best = s
      bestDistance = distance
    }
  }
  return { portion: best.portion, grams: best.grams }
}

/**
 * @param proteinSoFarG  protein logged today
 * @param targetG        the day's protein target
 * @param weightKg       bodyweight, so the line can state the g/kg assumption
 */
export function proteinCoachLine(
  proteinSoFarG: number,
  targetG: number,
  weightKg: number | null
): ProteinCoachLine | null {
  if (!Number.isFinite(targetG) || targetG <= 0) return null
  if (!Number.isFinite(proteinSoFarG) || proteinSoFarG < 0) return null

  const gap = Math.round(targetG - proteinSoFarG)

  if (gap <= 0) {
    // State the assumption on the win, where there's room to read it.
    const basis = weightKg && weightKg > 0
      ? ` That's ${PROTEIN_G_PER_KG}g per kg of bodyweight.`
      : ''
    return { tone: 'met', text: `Protein target hit — ${Math.round(proteinSoFarG)}g today.${basis}` }
  }

  // Within a rounding error of the target: don't send someone to the kitchen.
  if (gap <= 5) {
    return { tone: 'close', text: `${gap}g of protein to go — you're basically there.` }
  }

  const { portion } = bestSuggestion(gap)
  return { tone: 'gap', text: `${gap}g of protein to go — about ${portion} covers it.` }
}
