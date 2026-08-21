import { describe, it, expect } from 'vitest'
import { SPELLING_VARIANTS, foldSpelling } from '../lib/spelling-variants'
import { foodSynonyms } from '../lib/food-synonyms'

/**
 * The map is data, and the whole point of it is that a future entry can quietly
 * merge two foods that are not the same food. These are the invariants that
 * make adding to it safe.
 */
describe('SPELLING_VARIANTS', () => {
  const entries = Object.entries(SPELLING_VARIANTS)

  it('holds single lowercase alphabetic words on both sides', () => {
    // `foldSpelling` replaces alphabetic runs. A value carrying a space or a
    // bracket would inject structure into the name and break `nameReadings`.
    for (const [variant, canonical] of entries) {
      expect(variant, `variant "${variant}"`).toMatch(/^[a-z]+$/)
      expect(canonical, `canonical of "${variant}"`).toMatch(/^[a-z]+$/)
      expect(variant, `"${variant}" folds to itself`).not.toBe(canonical)
    }
  })

  it('is idempotent — no canonical spelling is itself a variant', () => {
    // Otherwise one pass of the fold lands somewhere a second pass would leave,
    // and query and name could normalise differently depending on the spelling.
    for (const [variant, canonical] of entries) {
      expect(
        SPELLING_VARIANTS[canonical],
        `"${variant}" → "${canonical}", which is itself folded`
      ).toBeUndefined()
      expect(foldSpelling(foldSpelling(variant))).toBe(foldSpelling(variant))
    }
  })

  it('never folds two different foods onto the same word', () => {
    // The guard that stops a translation sneaking in: `corn → bhutta` would
    // collapse two distinct synonym groups into one token, and the typed tier
    // would stop being able to tell them apart.
    const seen = new Map<string, string>()
    for (const canonical of Object.keys(foodSynonyms)) {
      const folded = foldSpelling(canonical)
      const clash = seen.get(folded)
      expect(clash, `"${canonical}" and "${clash}" both fold to "${folded}"`).toBeUndefined()
      seen.set(folded, canonical)
    }
  })

  it('leaves preparation qualifiers and punctuation alone', () => {
    // `isPlainForm` matches QUALIFIERS literally, so folding an English word
    // like "cooked" would quietly stop "Cooked Rice (Chawal)" being the plain
    // form of rice.
    for (const word of ['plain', 'raw', 'cooked', 'boiled', 'steamed', 'whole', 'dry', 'fresh']) {
      expect(foldSpelling(word)).toBe(word)
    }
    expect(foldSpelling('toor dal (arhar dal)')).toBe('toor dal (arhar dal)')
    expect(foldSpelling('moong daal / mung dal')).toBe('moong dal / moong dal')
  })

  it('folds the spellings that were reported broken', () => {
    expect(foldSpelling('daal')).toBe('dal')
    expect(foldSpelling('dhal')).toBe('dal')
    expect(foldSpelling('arahar daal')).toBe('arhar dal')
    expect(foldSpelling('chana daal')).toBe('chana dal')
  })

  it('does not fold translations — those belong to the synonym tier', () => {
    // Folding these into the typed tier is what brings back "bhutta returns
    // Cornflakes". See lib/spelling-variants.ts.
    for (const word of ['lentil', 'corn', 'curd', 'rice', 'milk', 'tea']) {
      expect(foldSpelling(word), `"${word}" must not fold`).toBe(word)
    }
  })

  it('leaves words that mean something else in another context', () => {
    // Nestlé NAN is infant formula, not naan.
    expect(foldSpelling('nan pro')).toBe('nan pro')
  })
})
