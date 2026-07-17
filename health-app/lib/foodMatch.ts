// Source trust for tie-breaking. IFCT (curated Indian) is most trustworthy for
// home food; branded/OFF are last. `estimate` rows never reach here (queries
// exclude them), but rank them lowest for safety.
const SOURCE_RANK: Record<string, number> = {
  ifct: 5,
  restaurant: 4,
  branded: 3,
  off_india: 2,
  off: 2,
  off_world: 1,
  estimate: 0,
}

/** Name-match quality: exact (4) > whole-string prefix (3) > word prefix (2) > substring (1). */
function nameScore(name: string, query: string): number {
  const n = name.toLowerCase().trim()
  const q = query.toLowerCase().trim()
  if (!q) return 0
  if (n === q) return 4
  if (n.startsWith(q)) return 3
  if (n.split(/[\s/,(]+/).some((w) => w.startsWith(q))) return 2
  if (n.includes(q)) return 1
  return 0
}

/**
 * Pick the best DB food for an AI-identified name. Name-match quality dominates;
 * source trust (ifct > restaurant > branded > off) breaks ties. Replaces the old
 * `.order('source')` which sorted *alphabetically* — putting `branded` ahead of
 * `ifct` — so "2 roti and dal" matched "Bajra Roti" + "Gits Dal Tadka".
 */
export function pickBestFoodMatch<T extends { name: string; source: string }>(
  rows: T[],
  query: string
): T | null {
  let best: T | null = null
  let bestScore = -1
  for (const row of rows) {
    const score = nameScore(row.name, query) * 10 + (SOURCE_RANK[row.source] ?? 0)
    if (score > bestScore) {
      bestScore = score
      best = row
    }
  }
  return best
}

/**
 * Reject foods whose nutrition is physically impossible — mostly bad Open Food
 * Facts rows (e.g. "163 g carbs / 100 g", solid food at "0 kcal"). Keeps the
 * search list trustworthy without hand-curating OFF.
 */
export function isPlausibleFood(f: {
  kcal_per_100g: number
  protein_g_per_100g: number
  carbs_g_per_100g: number
  fat_g_per_100g: number
}): boolean {
  const macros = (f.protein_g_per_100g ?? 0) + (f.carbs_g_per_100g ?? 0) + (f.fat_g_per_100g ?? 0)
  // Macros can't exceed 100 g per 100 g (small tolerance for rounding).
  if (macros > 100.5) return false
  // Pure fat is ~900 kcal/100 g — anything above is impossible.
  if (f.kcal_per_100g > 902) return false
  // Zero calories but real macros = a broken row (a genuine ~0-kcal item like
  // water/black coffee has ~0 macros too, so it survives).
  if (f.kcal_per_100g <= 0 && macros > 1) return false
  return true
}
