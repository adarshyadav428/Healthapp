import { foldSpelling } from './spelling-variants'

/** Split a food name into words. Mirrors the punctuation that shows up in our
 *  own data: "Bhutta (Roasted Corn)", "Masala Corn / Corn Chaat", "Dal, Toor". */
const nameWords = (name: string): string[] => name.split(/[\s/,()[\]-]+/).filter(Boolean)

/**
 * Lowercase, collapse whitespace, and fold romanisation variants to one
 * spelling. Every signal below routes through here, so the query and the name
 * are always folded the same way.
 *
 * The fold is what stops the user's *spelling* deciding the ranking. Scoring
 * "daal" literally made Haldiram's "Moong Daal" (a namkeen) the only perfect
 * typed-word match in the table, beating every measured lentil row — which
 * scored 0 and fell to the synonym tier — before SOURCE_RANK could break the
 * tie. See `lib/spelling-variants.ts` for why it folds spellings only and never
 * translations.
 */
const normalize = (s: string): string => foldSpelling(s.toLowerCase().replace(/\s+/g, ' ').trim())

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
 * The ways a name can be read as naming one food: the whole string, and each
 * alternative once the regional gloss and the slash-alternatives are set aside.
 *
 * Our own names carry their translation in parentheses ("Cooked Rice (Chawal)",
 * "Sweet Corn (Makkai)") or after a slash ("Kheer / Rice Pudding"). Counting the
 * gloss as part of the name made the *measured, plain* food look diluted:
 * "rice" covered only 1 of the 3 words in "Cooked Rice (Chawal)", so it lost the
 * coverage tier to the two-word dish "Jeera Rice" and the search for plain rice
 * returned every rice dish we hold above the rice itself.
 */
function nameReadings(name: string): string[][] {
  const n = normalize(name)
  const readings = [nameWords(n)]
  const head = n.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
  for (const segment of head.split('/')) {
    const parts = nameWords(segment)
    if (parts.length > 0) readings.push(parts)
  }
  return readings
}

const coverageOf = (parts: string[], words: string[]): number =>
  parts.length === 0 ? 0 : parts.filter((p) => words.some((w) => p.startsWith(w))).length / parts.length

/**
 * How much of the *name* the query accounts for, 0–1 — measured against the
 * reading of the name that the query explains best (see `nameReadings`).
 *
 * Separates "Bhutta (Roasted Corn)" from "Black bean crusted cod with roasted
 * corn & red pepper salsa" — both contain every word of "roasted corn", but one
 * is the dish and the other merely mentions it. Without this the tie fell to
 * source rank, and an Open Food Facts row took the top slot from the food the
 * user was plainly looking for.
 */
export function nameCoverage(name: string, query: string): number {
  const words = normalize(query).split(' ').filter(Boolean)
  return Math.max(...nameReadings(name).map((parts) => coverageOf(parts, words)))
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
 * Words that describe how a food was prepared or kept, not which food it is.
 * "Cooked Rice" and "Raw Rice" are both rice; "Jeera Rice" is a dish.
 */
const QUALIFIERS = new Set([
  'plain',
  'raw',
  'uncooked',
  'cooked',
  'boiled',
  'steamed',
  'fresh',
  'dry',
  'dried',
  'whole',
  'home',
  'homemade',
  'unsalted',
  'unsweetened',
  'ki',
  'ka',
  'and',
  'with',
  'the',
])

/**
 * Is this name the plain food the user typed, rather than a dish made from it?
 *
 * True when, after setting the regional gloss aside, nothing is left of the name
 * but the query words and preparation qualifiers. This is what makes a search
 * for "rice" answer with "Cooked Rice (Chawal)" instead of "Jeera Rice" and
 * "Sambar Rice" — all three match the word equally and cover their names
 * equally, so before this tier the answer came down to which row the source
 * ranking happened to favour, and the dishes buried the food.
 */
export function isPlainForm(name: string, query: string): boolean {
  const words = normalize(query).split(' ').filter(Boolean)
  if (words.length === 0) return false
  return nameReadings(name)
    .slice(1) // gloss-stripped readings only; the full string still carries it
    .some(
      (parts) =>
        parts.some((p) => words.includes(p)) &&
        parts.every((p) => words.includes(p) || QUALIFIERS.has(p))
    )
}

/**
 * The whole name a row goes by. A row carrying a `brand` is a packet, and the
 * name on it is the part the label prints big — not the food's whole name.
 *
 * Haldiram's "Moong Daal" is a fried namkeen. Once `daal` folds to `dal` its
 * name reads *exactly* like the query "moong daal", so it took the exact-match
 * score of 4 while the measured "Moong Dal (Yellow)" could only reach 3 —
 * deciding at tier 0, before `SOURCE_RANK` (ifct 6 > off_india 3) was ever
 * consulted. Scored as "Haldiram's Moong Daal" it drops to 3 and loses the
 * plain-form tier, because a brand token is neither a query word nor a
 * QUALIFIER. Type the brand and it wins again, which is correct.
 *
 * This adds no tier and reorders none — like `foldSpelling` and `nameReadings`,
 * it only fixes *which string* the existing tiers are applied to.
 */
export function foodIdentity(row: { name: string; brand?: string | null }): string {
  const brand = row.brand?.trim()
  if (!brand) return row.name
  // Don't say it twice: "Tata Sampann Moong Dal" already carries its brand, and
  // doubling the tokens would halve the coverage of a row that reads correctly.
  return normalize(row.name).includes(normalize(brand)) ? row.name : `${brand} ${row.name}`
}

/**
 * The search result ordering: how well the name matches, then how much of the
 * name the query explains, then how much we trust the source, then name.
 *
 * Source rank deliberately comes *after* both name signals — it exists to break
 * a genuine tie between comparable matches (measured IFCT over an estimate), not
 * to promote a poorly-matching row from a trusted source above a good one.
 */
export function compareFoodsForQuery<
  T extends { name: string; source: string; brand?: string | null },
>(
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
      isPlainForm(name, typed) ? 1 : 0,
      synRelevance,
      synCoverage,
    ]
    cache.set(name, scored)
    return scored
  }

  return (a, b) => {
    const sa = score(foodIdentity(a))
    const sb = score(foodIdentity(b))
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
