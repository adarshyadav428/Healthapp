import { describe, it, expect } from 'vitest'
import {
  boundedDistance,
  correctFoodQuery,
  foodVocabulary,
  nearestFoodWord,
} from '../lib/typo-correction'
import { foodSynonyms } from '../lib/food-synonyms'
import { SPELLING_VARIANTS } from '../lib/spelling-variants'

/**
 * Typo correction is the last thing that runs before a user sees an empty
 * screen, and the only thing in search allowed to change what was typed. These
 * tests pin the two halves of that: it reaches the food that was meant, and it
 * never touches a word we actually hold.
 */
describe('correctFoodQuery', () => {
  it('reaches the food behind the reported typos', () => {
    expect(correctFoodQuery('sbzi')).toBe('sabzi')
    expect(correctFoodQuery('chiken')).toBe('chicken')
    expect(correctFoodQuery('bryani')).toBe('biryani')
    expect(correctFoodQuery('panner')).toBe('paneer')
  })

  it('corrects word by word, leaving the words that are already right', () => {
    expect(correctFoodQuery('chiken bryani')).toBe('chicken biryani')
    expect(correctFoodQuery('paneer bhurgi')).toBe('paneer bhurji')
    expect(correctFoodQuery('sbzi paneer')).toBe('sabzi paneer')
  })

  it('keeps punctuation and quantities, like foldSpelling does', () => {
    // The corrected string goes on to `buildNameIlikeOrFilter`, which does its
    // own sanitising — but a correction that ate the comma would silently
    // change what the user asked for.
    expect(correctFoodQuery('2 sbzi, roti')).toBe('2 sabzi, roti')
    expect(correctFoodQuery('  SBZI  ')).toBe('sabzi')
  })

  it('leaves the spellings the fold already handles', () => {
    // `daal` and `dal` are not typos — `lib/spelling-variants.ts` folds them on
    // both sides of the comparison, and that is where they must keep being
    // handled. Correcting them here would be a second, competing answer.
    for (const spelling of ['dal', 'daal', 'dhal', 'sabzi', 'sabji', 'subzi']) {
      expect(correctFoodQuery(spelling), spelling).toBeNull()
    }
  })

  it('never rewrites a word we hold — the invariant that keeps it honest', () => {
    // Every catalogue name word, synonym term and known spelling. If any of
    // these were "corrected", a query that works today would start returning a
    // different food.
    const rewritten = [...foodVocabulary()].filter((word) => correctFoodQuery(word) !== null)
    expect(rewritten).toEqual([])
  })

  it('leaves every synonym term alone, including the multi-word ones', () => {
    for (const [canonical, synonyms] of Object.entries(foodSynonyms)) {
      for (const term of [canonical, ...synonyms]) {
        expect(correctFoodQuery(term), term).toBeNull()
      }
    }
  })

  it('leaves both sides of every spelling variant alone', () => {
    for (const [variant, canonical] of Object.entries(SPELLING_VARIANTS)) {
      expect(correctFoodQuery(variant), variant).toBeNull()
      expect(correctFoodQuery(canonical), canonical).toBeNull()
    }
  })

  it('is idempotent — a corrected query has nothing left to correct', () => {
    for (const typo of ['sbzi', 'chiken bryani', 'prantha', 'khichdee']) {
      const corrected = correctFoodQuery(typo)
      expect(corrected, typo).not.toBeNull()
      expect(correctFoodQuery(corrected as string), corrected as string).toBeNull()
    }
  })
})

describe('nearestFoodWord', () => {
  it('will not correct a short word', () => {
    // "dal", "dab" and "tal" are three different things one edit apart, and a
    // three-letter query is more often an abbreviation than a mistake.
    for (const word of ['sbz', 'chi', 'rot', 'dl']) {
      expect(nearestFoodWord(word), word).toBeNull()
    }
  })

  it('gives up when two different foods are equally close', () => {
    expect(nearestFoodWord('sabzj', new Set(['sabzi', 'sabza']))).toBeNull()
    expect(nearestFoodWord('sabzj', new Set(['sabzi']))).toBe('sabzi')
  })

  it('gives up on a real pair of foods one edit apart', () => {
    // kheer is a pudding, kheera is a cucumber. Both are one edit from
    // "kheerr", and a wrong answer here logs the wrong meal.
    expect(nearestFoodWord('kheerr')).toBeNull()
  })

  it('resolves a tie between two spellings of one food', () => {
    // "dosa" and "dosai" are both terms of one synonym group, so correcting to
    // either runs the identical expanded search — the tie is safe to take, and
    // the plainer spelling wins it.
    expect(nearestFoodWord('dosas')).toBe('dosa')
    expect(nearestFoodWord('idlii')).toBe('idli')
    expect(nearestFoodWord('eggg')).toBe('egg')
  })

  it('folds the correction, so a variant spelling still lands on the canonical', () => {
    // "prantha" is nearest to the variant "parantha", which is not itself a
    // catalogue spelling; folding the winner reaches "paratha".
    expect(nearestFoodWord('prantha')).toBe('paratha')
    expect(nearestFoodWord('pakodaa')).toBe('pakora')
  })

  it('corrects nothing when nothing is close', () => {
    expect(nearestFoodWord('xylophone')).toBeNull()
    expect(nearestFoodWord('qwertyuiop')).toBeNull()
  })
})

describe('boundedDistance', () => {
  it('counts a transposition as one edit, because that is what a thumb does', () => {
    expect(boundedDistance('sabiz', 'sabzi', 2)).toBe(1)
  })

  it('counts insertions, deletions and substitutions', () => {
    expect(boundedDistance('sabzi', 'sabzi', 1)).toBe(0)
    expect(boundedDistance('sbzi', 'sabzi', 1)).toBe(1)
    expect(boundedDistance('sabzii', 'sabzi', 1)).toBe(1)
    expect(boundedDistance('sabza', 'sabzi', 1)).toBe(1)
  })

  it('stops counting past the budget instead of measuring the whole word', () => {
    expect(boundedDistance('sabzi', 'biryani', 1)).toBe(2)
    expect(boundedDistance('sabzi', 'biryani', 2)).toBe(3)
  })
})
