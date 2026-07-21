/** Split a food name into words. Mirrors the punctuation that shows up in our
 *  own data: "Bhutta (Roasted Corn)", "Masala Corn / Corn Chaat", "Dal, Toor". */
const nameWords = (name: string): string[] => name.split(/[\s/,()[\]-]+/).filter(Boolean)

const normalize = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Score a food name against the query. Higher is better; 0 means no real match.
 *
 * Multi-word queries are scored word by word rather than as one literal string.
 * The old version asked whether the name contained the query verbatim, so
 * "roasted corn" scored "Bhutta (Roasted Corn)" no higher than "Baby Corn" —
 * both fell to the floor score and the tie went to whichever source ranked
 * higher, burying the exact match ten rows down. Word order and adjacency are
 * not things a user should have to guess at.
 *
 *   4  exact name
 *   3  every query word appears in the name as a complete word
 *   2  the name starts with the query, or every query word starts a word in it
 *   1  every query word appears somewhere in the name
 *   0  the name matched only via a synonym, not the words typed
 *
 * A complete-word match outranks a mere prefix on purpose. "Starts with" used to
 * score highest, which meant a biscuit called "milk bikis" beat "Toned Milk" for
 * the query "milk", and "Chai Latte Stick" beat "Masala Chai" — leading the
 * name is not evidence of being the thing, since "Milk Barfi" leads with it too.
 */
export function relevanceScore(name: string, query: string): number {
  const n = normalize(name)
  const q = normalize(query)
  if (!q) return 0
  if (n === q) return 4

  const words = q.split(' ').filter(Boolean)
  const parts = nameWords(n)
  if (words.every((w) => parts.includes(w))) return 3
  if (n.startsWith(q)) return 2
  if (words.every((w) => parts.some((p) => p.startsWith(w)))) return 2
  if (words.every((w) => n.includes(w))) return 1
  return 0
}

/**
 * How much of the *name* the query accounts for, 0–1.
 *
 * Separates "Bhutta (Roasted Corn)" from "Black bean crusted cod with roasted
 * corn & red pepper salsa" — both contain every word of "roasted corn", but one
 * is the dish and the other merely mentions it. Without this the tie fell to
 * source rank, and an Open Food Facts row took the top slot from the food the
 * user was plainly looking for.
 */
export function nameCoverage(name: string, query: string): number {
  const parts = nameWords(normalize(name))
  if (parts.length === 0) return 0
  const words = normalize(query).split(' ').filter(Boolean)
  const matched = parts.filter((p) => words.some((w) => p.startsWith(w))).length
  return matched / parts.length
}

/** Coverage at or above this share means the name is *about* the query. */
const DOMINANT_COVERAGE = 0.5

/**
 * Coverage as a yes/no signal: is the name about the query, or does it merely
 * mention it?
 *
 * Ranking on the raw fraction sorts by name length among rows that are equally
 * about the query — "Chai Latte Stick" (1 of 5 words) edged out "Masala Chai
 * (with milk & sugar)" (1 of 6) and took the top slot for "chai", because the
 * source tie-break below never got to run. Descriptive IFCT names should not be
 * punished for being descriptive.
 */
export function isCoverageDominant(name: string, query: string): boolean {
  return nameCoverage(name, query) >= DOMINANT_COVERAGE
}

/**
 * The search result ordering: how well the name matches, then how much of the
 * name the query explains, then how much we trust the source, then name.
 *
 * Source rank deliberately comes *after* both name signals — it exists to break
 * a genuine tie between comparable matches (measured IFCT over an estimate), not
 * to promote a poorly-matching row from a trusted source above a good one.
 */
export function compareFoodsForQuery<T extends { name: string; source: string }>(
  query: string | string[],
  sourceRank: Record<string, number>
): (a: T, b: T) => number {
  // Two tiers, and the order between them is the whole point.
  //
  // The word the user typed always decides first. Synonym matches only break a
  // tie among rows that the typed word ranked equally — otherwise a synonym
  // hijacks the query: searching "bhutta" put "Cornflakes" on top, because
  // `corn` is a synonym of bhutta and "Cornflakes" matches `corn` more
  // completely than "Bhutta (Roasted Corn)" does.
  //
  // Without the synonym tier at all, every row reached *only* through a synonym
  // scores zero and falls back to source rank — which is how "anjeer" returned
  // an Open Food Facts protein bar above "Figs (Dry)".
  const terms = (typeof query === 'string' ? [query] : query).filter(Boolean)
  const typed = terms[0] ?? ''
  const synonyms = terms.slice(1)
  const cache = new Map<string, number[]>()

  const score = (name: string): number[] => {
    const cached = cache.get(name)
    if (cached) return cached
    let synRelevance = 0
    let synCoverage = 0
    for (const term of synonyms) {
      const relevance = relevanceScore(name, term)
      const coverage = isCoverageDominant(name, term) ? 1 : 0
      if (relevance > synRelevance || (relevance === synRelevance && coverage > synCoverage)) {
        synRelevance = relevance
        synCoverage = coverage
      }
    }
    const scored = [
      relevanceScore(name, typed),
      isCoverageDominant(name, typed) ? 1 : 0,
      synRelevance,
      synCoverage,
    ]
    cache.set(name, scored)
    return scored
  }

  return (a, b) => {
    const sa = score(a.name)
    const sb = score(b.name)
    for (let i = 0; i < sa.length; i++) {
      if (Math.abs(sa[i] - sb[i]) > 1e-9) return sb[i] > sa[i] ? 1 : -1
    }
    const bySource = (sourceRank[b.source] ?? 0) - (sourceRank[a.source] ?? 0)
    if (bySource !== 0) return bySource
    // Everything else equal, the shorter name is the plainer food: "Toned Milk"
    // over "Masala Milk (Spiced Milk)", "Sweet Corn" over "Masala Corn / Corn
    // Chaat". Alphabetical order — the previous last resort — is arbitrary.
    if (a.name.length !== b.name.length) return a.name.length - b.name.length
    return a.name.localeCompare(b.name)
  }
}
