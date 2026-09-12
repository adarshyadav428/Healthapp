/**
 * The portion a food was last logged at, keyed by food id.
 *
 * The Food screen's "+" has one rule: a food you have logged before goes
 * straight in at the amount you used last time; a food you have never logged
 * opens the portion sheet first. This map is what makes that decision, derived
 * from the same recent-log snapshot app/log/page.tsx already fetches for
 * "Log again" — no new persistence, no extra query.
 *
 * Rows arrive newest first (the page orders by logged_at desc), so the first
 * row seen for a food is its most recent portion.
 */
export type LastPortion = { grams: number; kcal: number; meal: string }

export type LastPortionRow = {
  food_id: string | null
  grams: number | null
  kcal: number | null
  meal: string | null
}

export function lastPortionsFrom(rows: LastPortionRow[]): Record<string, LastPortion> {
  const out: Record<string, LastPortion> = {}
  for (const row of rows) {
    if (!row.food_id || out[row.food_id]) continue
    // A row with no grams is a quick-add (calories only) and says nothing
    // about a portion — skip it rather than teaching "+" to log 0 g.
    if (!row.grams || row.grams <= 0) continue
    out[row.food_id] = { grams: row.grams, kcal: row.kcal ?? 0, meal: row.meal ?? 'snack' }
  }
  return out
}
