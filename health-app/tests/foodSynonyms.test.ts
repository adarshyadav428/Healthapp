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

/**
 * Terms found broken by probing the live catalogue: the food was there, but the
 * word a user would type reached nothing. Each pair is [what you type, a word in
 * the catalogue name it must now reach]. Terms whose food does not exist at all
 * (turnip/shalgam, yam/suran, cluster beans/gwar, lotus stem) are deliberately
 * absent — a synonym pointing at no row is worse than none.
 */
const brokenTerms: [string, string][] = [
  ['ananas', 'pineapple'],
  ['khajoor', 'dates'],
  ['anjeer', 'fig'],
  ['kishmish', 'raisins'],
  ['laddu', 'ladoo'],
  ['laddoo', 'ladoo'],
  ['rosogolla', 'rasgulla'],
  ['burfi', 'barfi'],
  ['chhena', 'paneer'],
  ['chach', 'chaas'],
  ['chaach', 'chaas'],
  ['matha', 'chaas'],
  ['sevai', 'vermicelli'],
  ['semiya', 'vermicelli'],
  ['uttappam', 'uttapam'],
  ['thengai', 'coconut'],
  ['muri', 'murmura'],
  ['murmure', 'murmura'],
  ['jhalmuri', 'murmura'],
  ['machhli', 'fish'],
  ['kachalu', 'arbi'],
]

describe('regional names that used to reach nothing', () => {
  it.each(brokenTerms)('"%s" now expands to reach "%s"', (typed, expected) => {
    expect(expandSearchQuery(typed)).toContain(expected)
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

  it('does not match a synonym buried inside an unrelated word', () => {
    // "nan" is a substring of "ananas": the naan group used to match, and its
    // terms filled the 6-term filter budget before "pineapple" was reached, so
    // searching for pineapple returned bread.
    const expanded = expandSearchQuery('ananas')
    expect(expanded).toContain('pineapple')
    expect(expanded).not.toContain('naan')
  })

  it('still matches a synonym that is a whole word inside a longer query', () => {
    expect(expandSearchQuery('aloo paratha')).toContain('potato')
    expect(expandSearchQuery('garlic naan')).toContain('naan')
  })

  it('does not pull in every group that merely mentions a common word', () => {
    // Live report: "rice" returned a screenful of foods that are not rice.
    // "rice pudding" (kheer), "flattened rice" (poha) and "puffed rice"
    // (murmura) each contain the word, and every one of those groups used to
    // expand the query.
    const rice = expandSearchQuery('rice')
    expect(rice).toContain('chawal')
    expect(rice).not.toContain('kheer')
    expect(rice).not.toContain('poha')
    expect(rice).not.toContain('murmura')

    // Searching the dish by name still reaches its group.
    expect(expandSearchQuery('rice pudding')).toContain('kheer')
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
