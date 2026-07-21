import { describe, it, expect } from 'vitest'
import { expandSearchQuery, foodSynonyms } from '../lib/food-synonyms'
import { buildNameIlikeOrFilter } from '../lib/searchFilter'

/**
 * Reported bug: roasted corn was unfindable. The row ("Bhutta (Roasted Corn)")
 * was in the database the whole time — but corn has more regional names than
 * almost any other Indian street food and none of them share a substring, so
 * "makki" could never reach "bhutta".
 */
describe('corn synonyms', () => {
  const cornWords = ['bhutta', 'makki', 'makkai', 'corn', 'maize', 'challi']

  it.each(cornWords)('expands "%s" to reach the roasted-corn row', (word) => {
    const expanded = expandSearchQuery(word)
    expect(expanded).toContain('bhutta')
    expect(expanded).toContain('corn')
  })

  it('keeps the typed word first so relevance ranking still favours it', () => {
    expect(expandSearchQuery('makki')[0]).toBe('makki')
  })

  it('survives the 6-term cap with the common spellings intact', () => {
    // buildNameIlikeOrFilter keeps only the first 6 terms, so the ordering of
    // the synonym group is load-bearing, not cosmetic.
    const filter = buildNameIlikeOrFilter(expandSearchQuery('makki'), 6)
    expect(filter).toContain('%bhutta%')
    expect(filter).toContain('%corn%')
  })
})

describe('synonym groups', () => {
  it('lists every group member as a synonym of itself', () => {
    // A group whose members do not expand to each other is a silent dead end —
    // exactly the failure mode corn had by being absent entirely.
    for (const [canonical, synonyms] of Object.entries(foodSynonyms)) {
      for (const word of synonyms) {
        expect(expandSearchQuery(word), `"${word}" (group "${canonical}")`).toContain(canonical)
      }
    }
  })

  it('has no empty or whitespace-padded entries', () => {
    for (const [canonical, synonyms] of Object.entries(foodSynonyms)) {
      for (const word of synonyms) {
        expect(word, `group "${canonical}"`).toBe(word.trim())
        expect(word.length, `group "${canonical}"`).toBeGreaterThan(0)
        expect(word, `group "${canonical}"`).toBe(word.toLowerCase())
      }
    }
  })
})
