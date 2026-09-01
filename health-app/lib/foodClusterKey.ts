import { nameWords, normalize } from './searchRanking'
import { foodSynonyms } from './food-synonyms'

/**
 * Which synonym group(s) a single word belongs to, built once from every
 * phrase in every group ("flattened rice" tags both "flattened" and "rice"
 * with the `poha` group, alongside "poha" itself, since a group holds
 * multi-word phrases, not just single words — see `lib/food-synonyms.ts`).
 * A word can land in more than one group (`chicken` sits in five).
 */
const wordGroups = new Map<string, Set<string>>()
for (const [group, terms] of Object.entries(foodSynonyms)) {
  for (const term of terms) {
    for (const word of nameWords(normalize(term))) {
      if (!wordGroups.has(word)) wordGroups.set(word, new Set())
      wordGroups.get(word)!.add(group)
    }
  }
}

const groupsOf = (word: string): Set<string> => wordGroups.get(word) ?? new Set()

/**
 * Is `segmentWords` safe to drop when building a cluster identity for a name
 * whose other reading is `baseWords`? True only when every word in the
 * segment either repeats a base word outright, or shares a synonym group
 * with one — i.e. the segment is a translation/gloss of the base, not new
 * information.
 *
 * This is what tells "Boiled Egg (Anda)" apart from "Frankie Roll (Chicken)":
 * `anda` and `egg` sit in the same synonym group (`lib/food-synonyms.ts`),
 * so the parenthetical is droppable — the row reduces to "boiled egg" and
 * clusters with the plain "Boiled Egg". `chicken` sits in five groups, none
 * of which "frankie" or "roll" belong to, so it is never droppable — the row
 * keeps its own identity and does not cluster with "Frankie Roll (Veg)".
 */
function isGloss(segmentWords: string[], baseWords: readonly string[]): boolean {
  if (segmentWords.length === 0) return true
  const baseSet = new Set(baseWords)
  return segmentWords.every((w) => {
    if (baseSet.has(w)) return true
    const groups = groupsOf(w)
    if (groups.size === 0) return false
    return baseWords.some((b) => {
      for (const g of groupsOf(b)) if (groups.has(g)) return true
      return false
    })
  })
}

/**
 * A conservative identity for "is this the same food". Two rows share a
 * cluster key only when their names read as the same food after folding
 * spelling and dropping parenthetical/slash content that is a genuine
 * translation of the rest of the name — never on singular/plural, never on
 * a qualifier or a real distinguishing word ("boiled" vs "raw", "veg" vs
 * "chicken" stay distinct rows), never across brands.
 *
 * Built from the exact same `normalize`/`nameWords` split `searchRanking.ts`
 * scores against, so a cluster key and a search score never disagree on what
 * counts as a word.
 *
 * Deliberately conservative: under-clustering just leaves two rows for a food
 * a user can still find both of; over-clustering is unrecoverable once search
 * results are hard-collapsed to one row per cluster (`collapseDuplicateFoods`
 * in `lib/mergeSearchResults.ts`). An earlier version of this function
 * treated *every* parenthetical or post-slash segment as droppable gloss,
 * the same simplification `nameReadings` (searchRanking.ts) makes for
 * ranking — safe there because a wrongly-dropped word only costs a rank, not
 * a merge. Here it silently merged "Brown Rice (Cooked)" with "Brown Rice
 * (Raw)", "Sabudana (Cooked)" with the raw "Sabudana (Tapioca Pearls)", and
 * "Dates (Fresh)" with "Dates (Dry)" — caught by
 * `tests/foodDataQuality.test.ts` before it shipped. `isGloss` is the fix:
 * a segment is dropped only when it is demonstrably a translation (shares a
 * synonym group with the rest of the name), not merely bracketed. Widening
 * this further (plurals, dropping true qualifiers like "raw"/"cooked") is a
 * deliberate follow-up with its own evidence, not a refinement to fold in
 * here.
 */
export function foodClusterKey(row: { name: string; brand?: string | null }): string {
  const n = normalize(row.name)
  const brackets: string[] = []
  const withoutBrackets = n.replace(/\([^)]*\)|\[[^\]]*\]/g, (m) => {
    brackets.push(m.slice(1, -1))
    return ' '
  })
  const [head, ...slashSegments] = withoutBrackets.split('/')
  const baseWords = nameWords(head)

  const kept = [...brackets, ...slashSegments]
    .map((segment) => nameWords(segment))
    .filter((segmentWords) => !isGloss(segmentWords, baseWords))

  const words = Array.from(new Set([...baseWords, ...kept.flat()])).sort()
  return `${words.join(' ')}|${normalize(row.brand ?? '')}`
}
