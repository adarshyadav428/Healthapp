import { describe, it, expect } from 'vitest'
import { relevanceScore, nameCoverage, compareFoodsForQuery } from '../lib/searchRanking'
import { SOURCE_RANK } from '../lib/foodMatch'

/**
 * The ranking half of the multi-word search bug. Synonym expansion widens the
 * DB query, so a search for "roasted corn" also pulls in every cornflake we
 * hold — and if the *exact* match cannot outscore them it lands ten rows down
 * and the user concludes the food isn't in the app.
 */
describe('relevanceScore', () => {
  it('ranks an exact name highest', () => {
    expect(relevanceScore('Bhutta', 'bhutta')).toBe(4)
  })

  it('ranks a whole-query prefix above a word match', () => {
    expect(relevanceScore('Cornflakes', 'corn')).toBe(3)
    expect(relevanceScore('Sweet Corn (Makkai)', 'corn')).toBe(2)
  })

  it('scores every query word independently, ignoring order', () => {
    const cob = 'Bhutta (Roasted Corn)'
    expect(relevanceScore(cob, 'roasted corn')).toBe(2)
    expect(relevanceScore(cob, 'corn roasted')).toBe(2)
    expect(relevanceScore(cob, 'bhutta corn')).toBe(2)
  })

  it('puts the exact dish above an unrelated one that shares a single word', () => {
    // The regression: both used to score 1, so the tie fell to source rank and
    // buried the roasted corn cob under measured-but-irrelevant rows.
    const cob = relevanceScore('Bhutta (Roasted Corn)', 'roasted corn')
    const baby = relevanceScore('Baby Corn (Chhote Makai)', 'roasted corn')
    expect(cob).toBeGreaterThan(baby)
  })

  it('gives nothing to a name that only matched via a synonym', () => {
    expect(relevanceScore('Makki ki Roti', 'roasted corn')).toBe(0)
  })

  it('still scores a substring-only match above no match', () => {
    expect(relevanceScore('Cornflakes', 'flake')).toBe(1)
    expect(relevanceScore('Cornflakes', 'biryani')).toBe(0)
  })

  it('is unaffected by punctuation and casing in the name', () => {
    expect(relevanceScore('MASALA CORN / CORN CHAAT', 'corn chaat')).toBe(2)
    expect(relevanceScore('Dal, Toor', 'toor')).toBe(2)
  })

  it('preserves single-word behaviour exactly', () => {
    expect(relevanceScore('Chicken Biryani', 'chicken biryani')).toBe(4)
    expect(relevanceScore('Chicken Biryani Hyderabadi', 'chicken')).toBe(3)
    expect(relevanceScore('Hyderabadi Chicken Biryani', 'chicken')).toBe(2)
  })

  it('handles an empty query without claiming a match', () => {
    expect(relevanceScore('Bhutta', '')).toBe(0)
  })
})

describe('nameCoverage', () => {
  it('rates a dish above a name that merely mentions the ingredient', () => {
    const cob = nameCoverage('Bhutta (Roasted Corn)', 'roasted corn')
    const salsa = nameCoverage('Black bean crusted cod with roasted corn & red pepper salsa', 'roasted corn')
    expect(cob).toBeGreaterThan(salsa)
  })

  it('is 1 when the query accounts for the whole name', () => {
    expect(nameCoverage('Chicken Biryani', 'chicken biryani')).toBe(1)
  })

  it('is 0 for a name sharing nothing with the query', () => {
    expect(nameCoverage('Makki ki Roti', 'biryani')).toBe(0)
  })
})

describe('compareFoodsForQuery', () => {
  const rank = (names: [string, string][], query: string) =>
    names
      .map(([name, source]) => ({ name, source }))
      .sort(compareFoodsForQuery(query, SOURCE_RANK))
      .map((f) => f.name)

  it('puts the roasted corn cob above an OFF row that outranks it by source', () => {
    // The live regression: both score 2 on "roasted corn", and off (3) beats
    // curated (1), so the salsa took the top slot until coverage was added.
    const order = rank(
      [
        ['Black bean crusted cod with roasted corn & red pepper salsa', 'off'],
        ['Bhutta (Roasted Corn)', 'curated'],
      ],
      'roasted corn'
    )
    expect(order[0]).toBe('Bhutta (Roasted Corn)')
  })

  it('still lets a measured row win a genuine tie against an estimate', () => {
    const order = rank(
      [
        ['Chicken Biryani', 'curated'],
        ['Chicken Biryani', 'ifct'],
      ],
      'chicken biryani'
    )
    expect(order[0]).toBe('Chicken Biryani')
    // Same name and coverage, so the tie must have gone to the measured source.
    const sorted = [
      { name: 'Chicken Biryani', source: 'curated' },
      { name: 'Chicken Biryani', source: 'ifct' },
    ].sort(compareFoodsForQuery('chicken biryani', SOURCE_RANK))
    expect(sorted[0].source).toBe('ifct')
  })

  it('ignores the order the user typed the words in', () => {
    const foods: [string, string][] = [
      ['Veg Biryani', 'ifct'],
      ['Chicken Biryani', 'ifct'],
    ]
    expect(rank(foods, 'chicken biryani')[0]).toBe('Chicken Biryani')
    expect(rank(foods, 'biryani chicken')[0]).toBe('Chicken Biryani')
  })

  it('is a stable, total ordering (no comparator contradictions)', () => {
    const foods: [string, string][] = [
      ['Cornflakes', 'ifct'],
      ['Bhutta (Roasted Corn)', 'curated'],
      ['Sweet Corn (Makkai)', 'ifct'],
      ['Corn Flakes Original', 'off'],
      ['Makki ki Roti', 'ifct'],
    ]
    const once = rank(foods, 'corn')
    const twice = rank(foods.slice().reverse(), 'corn')
    expect(once).toEqual(twice)
  })
})
