/**
 * lib/typo-correction.ts
 *
 * Nearest-known-spelling correction for a food search that found nothing.
 *
 * A typo dies at *retrieval*, not at ranking: the local filter is
 * `name ILIKE '%sbzi%'` (`lib/searchFilter.ts`), so a fat-fingered "sbzi"
 * returns zero rows and everything `lib/searchRanking.ts` knows about tiers,
 * coverage and source trust never gets a chance to run. The user sees an empty
 * screen and concludes we don't have sabzi.
 *
 * This is the sibling of `lib/spelling-variants.ts`, and the split matters:
 * that map handles *deliberate* romanisations ("nobody agrees how to spell an
 * Indian food in the Latin alphabet") and folds them on both sides of every
 * comparison. It is hand-written, so it can only ever hold spellings a person
 * chose. There are hundreds of ways to mistype "sabzi" and enumerating them by
 * hand is not a plan — so accidents are handled here instead, by distance.
 *
 * Two rules keep this from inventing foods:
 *
 * 1. **A word we already hold is never touched.** The vocabulary is built from
 *    the synonym groups, the spelling map and every catalogue name, so "dal",
 *    "daal", "sabzi" and "sabji" pass straight through and go on being handled
 *    by `foldSpelling` exactly as they are today.
 * 2. **Ambiguity kills the correction.** If the nearest candidates fold to more
 *    than one canonical food, leave the word alone rather than guess between
 *    two different dinners.
 *
 * The caller adds a third, and it is the one that makes this safe to ship:
 * `app/api/foods/search/route.ts` only consults this module when a search
 * returned *nothing at all*. A vocabulary built from our own catalogue cannot
 * know a product Open Food Facts holds and we don't, so it must never rewrite a
 * query that already found rows — a search for "milo" returns Milo, and only a
 * search that would otherwise show an empty screen is allowed to become "milk".
 *
 * `tests/typoCorrection.test.ts` pins all of it.
 */
import { foldSpelling, SPELLING_VARIANTS } from './spelling-variants'
import { foodSynonyms } from './food-synonyms'
import { INDIAN_FOODS } from './indian-foods-data'
import { CURATED_FOODS } from './curated-foods-data'

/** Shortest word worth holding as a target. Below this everything neighbours everything. */
const MIN_TARGET_LENGTH = 3

/**
 * Shortest word we will correct. "dal", "dab" and "tal" are three different
 * things one character apart, and a three-letter query is more often an
 * abbreviation than a mistake.
 */
const MIN_CORRECT_LENGTH = 4

/** A longer word earns a second edit; a short one does not. */
const maxEdits = (word: string): number => (word.length >= 7 ? 2 : 1)

/** Split a food name into words. Mirrors `nameWords` in `lib/searchRanking.ts`. */
const nameWords = (name: string): string[] => name.split(/[\s/,()[\]-]+/).filter(Boolean)

let cachedVocabulary: Set<string> | null = null

/**
 * Every food word we hold, in the spellings we hold it in.
 *
 * Surface forms, not canonical ones: "prantha" is a mistype of the variant
 * "parantha", which is not itself a catalogue spelling. Matching the surface and
 * folding the winner afterwards reaches "paratha"; folding the vocabulary first
 * would have thrown away the bridge. Built once, lazily, from data that already
 * ships — there is no list here to keep in sync.
 */
export function foodVocabulary(): Set<string> {
  if (cachedVocabulary) return cachedVocabulary
  const words = new Set<string>()
  const add = (raw: string): void => {
    for (const word of nameWords(raw.toLowerCase())) {
      if (word.length >= MIN_TARGET_LENGTH && /^[a-z]+$/.test(word)) words.add(word)
    }
  }
  for (const [canonical, synonyms] of Object.entries(foodSynonyms)) {
    add(canonical)
    synonyms.forEach(add)
  }
  for (const [variant, canonical] of Object.entries(SPELLING_VARIANTS)) {
    add(variant)
    add(canonical)
  }
  for (const food of [...INDIAN_FOODS, ...CURATED_FOODS]) add(food.name)
  cachedVocabulary = words
  return words
}

let cachedGroupKeys: Map<string, string> | null = null

/**
 * The synonym group a word belongs to, when it belongs to exactly one.
 *
 * Used only to decide whether two equally-close candidates are the same food.
 * They are, if they sit in one group: `expandSearchQuery` expands either one to
 * the whole group, so correcting "dosas" to "dosa" and correcting it to "dosai"
 * run the identical search. That makes the tie safe to resolve rather than
 * abandon, and "idlii", "dosas" and "eggg" reach their food instead of the
 * empty screen they would otherwise share with a genuine ambiguity.
 *
 * Single-word terms only. A word lifted out of a multi-word term ("boiled",
 * from "boiled egg") is *not* a term of the group — `expandSearchQuery` would
 * not expand it — so the identical-search argument above would not hold for it.
 */
function synonymGroupOf(word: string): string | undefined {
  if (!cachedGroupKeys) {
    const groups = new Map<string, string>()
    const shared = new Set<string>()
    for (const [canonical, synonyms] of Object.entries(foodSynonyms)) {
      for (const term of [canonical, ...synonyms]) {
        if (term.includes(' ')) continue
        const folded = foldSpelling(term)
        const seen = groups.get(folded)
        // A word two groups both claim ("rice", in chawal and fried rice) tells
        // us nothing about which food a candidate is.
        if (seen !== undefined && seen !== canonical) shared.add(folded)
        else groups.set(folded, canonical)
      }
    }
    shared.forEach((word) => groups.delete(word))
    cachedGroupKeys = groups
  }
  return cachedGroupKeys.get(word)
}

/**
 * Damerau-Levenshtein (optimal string alignment) distance, abandoned as soon as
 * every remaining path costs more than `max` — the common case here, since we
 * measure one query word against a few thousand candidates. Returns `max + 1`
 * to mean "further away than you asked about".
 *
 * A transposition costs one edit because that is what a thumb actually does:
 * "sabiz" is one slip from "sabzi", not two.
 */
export function boundedDistance(a: string, b: string, max: number): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > max) return max + 1
  let beforePrevious: number[] = []
  let previous: number[] = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = new Array<number>(b.length + 1)
    current[0] = i
    let rowMin = i
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      let best = Math.min(previous[j] + 1, current[j - 1] + 1, substitution)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, beforePrevious[j - 2] + 1)
      }
      current[j] = best
      if (best < rowMin) rowMin = best
    }
    if (rowMin > max) return max + 1
    beforePrevious = previous
    previous = current
  }
  return previous[b.length]
}

/**
 * The one food word `word` is most likely a mistype of, or null.
 *
 * Null when the word is one we already hold, when it is too short to correct,
 * when nothing is close enough, or when the closest candidates disagree about
 * which food they are.
 *
 * `vocabulary` is injectable so the ambiguity rule can be tested against a
 * fixture rather than against whatever the catalogue happens to hold today.
 */
export function nearestFoodWord(
  word: string,
  vocabulary: Set<string> = foodVocabulary()
): string | null {
  if (word.length < MIN_CORRECT_LENGTH) return null
  if (vocabulary.has(word) || vocabulary.has(foldSpelling(word))) return null

  const max = maxEdits(word)
  let bestDistance = max + 1
  // Keyed by which food the candidate is, holding the plainest spelling of it.
  const nearest = new Map<string, string>()
  for (const candidate of vocabulary) {
    // Never look past the edit budget, or past the best already found. A
    // candidate beyond either is not a rival, and treating it as one made every
    // long word "ambiguous" against the noise sitting two edits away — which is
    // most of the catalogue.
    const limit = Math.min(max, bestDistance)
    const distance = boundedDistance(word, candidate, limit)
    if (distance > limit) continue
    if (distance < bestDistance) {
      bestDistance = distance
      nearest.clear()
    }
    const folded = foldSpelling(candidate)
    const food = synonymGroupOf(folded) ?? folded
    const held = nearest.get(food)
    // Shortest wins within one food: "dosa" over "dosai", "egg" over "eggs" —
    // the same reason the search comparator falls back to the shorter name.
    if (held === undefined || folded.length < held.length) nearest.set(food, folded)
    // Two different foods, equally close: we cannot tell which one was meant.
    if (nearest.size > 1) return null
  }
  if (nearest.size !== 1) return null

  const [canonical] = nearest.values()
  return canonical === foldSpelling(word) ? null : canonical
}

/**
 * Rewrite each mistyped word in `query` to the nearest food word we hold.
 * Returns null when nothing changed, so the caller can tell "no correction
 * exists" from "corrected to the same thing".
 *
 * Alphabetic runs are rewritten the way `foldSpelling` rewrites them, so
 * punctuation and quantities survive: "2 sbzi, roti" keeps its comma.
 */
export function correctFoodQuery(query: string): string | null {
  const lower = query.toLowerCase().replace(/\s+/g, ' ').trim()
  const corrected = lower.replace(/[a-z]+/g, (word) => nearestFoodWord(word) ?? word)
  return corrected === lower ? null : corrected
}
