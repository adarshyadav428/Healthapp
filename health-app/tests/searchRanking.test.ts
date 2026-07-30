import { describe, it, expect } from 'vitest'
import { relevanceScore, nameCoverage, isPlainForm, compareFoodsForQuery } from '../lib/searchRanking'
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

  it('ranks a complete word above a mere prefix', () => {
    // "corn" is a whole word in "Sweet Corn" but only the start of a longer
    // word in "Cornflakes" — the food called corn should win.
    expect(relevanceScore('Sweet Corn (Makkai)', 'corn')).toBe(3)
    expect(relevanceScore('Cornflakes', 'corn')).toBe(2)
  })

  it('does not let a leading word masquerade as the food itself', () => {
    // Regression: "milk bikis" (a biscuit) beat "Toned Milk" for "milk",
    // purely by starting with the word. "Milk Barfi" starts with it too.
    expect(relevanceScore('Toned Milk', 'milk')).toBe(3)
    expect(relevanceScore('milk bikis', 'milk')).toBe(3)
    expect(relevanceScore('Masala Chai (with milk & sugar)', 'chai')).toBe(3)
    expect(relevanceScore('Chai Latte Stick - Cinnamon', 'chai')).toBe(3)
  })

  it('scores every query word independently, ignoring order', () => {
    const cob = 'Bhutta (Roasted Corn)'
    expect(relevanceScore(cob, 'roasted corn')).toBe(3)
    expect(relevanceScore(cob, 'corn roasted')).toBe(3)
    expect(relevanceScore(cob, 'bhutta corn')).toBe(3)
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
    expect(relevanceScore('MASALA CORN / CORN CHAAT', 'corn chaat')).toBe(3)
    expect(relevanceScore('Dal, Toor', 'toor')).toBe(3)
  })

  it('treats a word as equally matched wherever it sits in the name', () => {
    expect(relevanceScore('Chicken Biryani', 'chicken biryani')).toBe(4)
    // Position no longer decides; both contain "chicken" as a whole word, and
    // source rank / coverage settle it rather than word order.
    expect(relevanceScore('Chicken Biryani Hyderabadi', 'chicken')).toBe(3)
    expect(relevanceScore('Hyderabadi Chicken Biryani', 'chicken')).toBe(3)
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

describe('nameCoverage with a regional gloss', () => {
  it('does not count the translation against the plain food', () => {
    // "Cooked Rice (Chawal)" is 1-of-3 words if the gloss counts, which lost the
    // coverage tier to the 1-of-2 dish "Jeera Rice" and buried plain rice.
    expect(nameCoverage('Cooked Rice (Chawal)', 'rice')).toBeGreaterThanOrEqual(
      nameCoverage('Jeera Rice', 'rice')
    )
  })

  it('reads each slash alternative as a name of its own', () => {
    expect(nameCoverage('Kheer / Rice Pudding', 'kheer')).toBe(1)
  })
})

describe('isPlainForm', () => {
  it('accepts the food itself, however it was prepared', () => {
    expect(isPlainForm('Cooked Rice (Chawal)', 'rice')).toBe(true)
    expect(isPlainForm('Raw Rice (Chawal)', 'rice')).toBe(true)
    expect(isPlainForm('Steamed Rice', 'rice')).toBe(true)
  })

  it('rejects a dish made from it', () => {
    expect(isPlainForm('Jeera Rice (Cumin Rice)', 'rice')).toBe(false)
    expect(isPlainForm('Sambar Rice (Combo)', 'rice')).toBe(false)
    expect(isPlainForm('Kheer (rice)', 'rice')).toBe(false)
    expect(isPlainForm('Curd Rice (Thayir Sadam)', 'rice')).toBe(false)
  })
})

describe('compareFoodsForQuery', () => {
  const rank = (names: [string, string][], query: string) =>
    names
      .map(([name, source]) => ({ name, source }))
      .sort(compareFoodsForQuery(query, SOURCE_RANK))
      .map((f) => f.name)

  it('prefers the plainer food when everything else ties', () => {
    const order = rank(
      [
        ['Masala Milk (Spiced Milk)', 'ifct'],
        ['Toned Milk', 'ifct'],
      ],
      'milk'
    )
    expect(order[0]).toBe('Toned Milk')
  })

  it('puts the real milk above a biscuit named after it', () => {
    const order = rank(
      [
        ['milk bikis', 'off'],
        ['Toned Milk', 'ifct'],
      ],
      'milk'
    )
    expect(order[0]).toBe('Toned Milk')
  })

  it('puts real chai above a latte stick, despite the longer name', () => {
    // Raw coverage ranked these by name length (1-of-5 beat 1-of-6) and the
    // source tie-break never ran. Descriptive IFCT names must not be punished.
    const order = rank(
      [
        ['Chai Latte Stick - Cinnamon', 'off'],
        ['Masala Chai (with milk & sugar)', 'ifct'],
      ],
      'chai'
    )
    expect(order[0]).toBe('Masala Chai (with milk & sugar)')
  })

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

  it('ranks synonym-matched rows on the synonym, not on source alone', () => {
    // "anjeer" appears in no food name, so every row scored 0 against it and
    // an OFF protein bar outranked the actual dried figs.
    const foods = [
      { name: 'Breakfast Protein Bar Apricot Fig', source: 'off' },
      { name: 'Figs (Dry)', source: 'curated' },
    ]
    const typedOnly = foods.slice().sort(compareFoodsForQuery('anjeer', SOURCE_RANK))
    expect(typedOnly[0].name).toBe('Breakfast Protein Bar Apricot Fig')

    const expanded = foods.slice().sort(compareFoodsForQuery(['anjeer', 'fig', 'figs'], SOURCE_RANK))
    expect(expanded[0].name).toBe('Figs (Dry)')
  })

  it('never lets a synonym hijack the word the user typed', () => {
    // "Cornflakes" matches the synonym `corn` more completely than
    // "Bhutta (Roasted Corn)" does, and briefly took the top slot for "bhutta".
    const foods = [
      { name: 'Cornflakes', source: 'ifct' },
      { name: 'Bhutta (Roasted Corn)', source: 'curated' },
    ]
    const sorted = foods.slice().sort(compareFoodsForQuery(['bhutta', 'corn', 'makki'], SOURCE_RANK))
    expect(sorted[0].name).toBe('Bhutta (Roasted Corn)')
  })

  it('keeps the more specific dish when the query names it', () => {
    const foods = [
      { name: 'Naan', source: 'ifct' },
      { name: 'Garlic Naan', source: 'ifct' },
    ]
    const sorted = foods.slice().sort(compareFoodsForQuery(['garlic naan', 'naan', 'nan'], SOURCE_RANK))
    expect(sorted[0].name).toBe('Garlic Naan')
  })

  it('accepts a bare string as a single-term list', () => {
    const foods = [
      { name: 'Veg Biryani', source: 'ifct' },
      { name: 'Chicken Biryani', source: 'ifct' },
    ]
    expect(foods.slice().sort(compareFoodsForQuery('chicken biryani', SOURCE_RANK))[0].name).toBe(
      'Chicken Biryani'
    )
  })

  it('answers a one-word food query with the food, not the dishes made from it', () => {
    // The live report: searching "rice" returned Jeera Rice, Sambar Rice and
    // Steamed Rice before any row that is simply rice.
    const order = rank(
      [
        ['Jeera Rice', 'curated'],
        ['Sambar Rice', 'curated'],
        ['Kheer (rice)', 'ifct'],
        ['Cooked Rice (Chawal)', 'ifct'],
        ['Veg Fried Rice (Indian Chinese)', 'ifct'],
      ],
      'rice'
    )
    expect(order[0]).toBe('Cooked Rice (Chawal)')
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
