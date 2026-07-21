import { describe, it, expect } from 'vitest'
import { sanitizeFilterTerm, buildNameIlikeOrFilter } from '../lib/searchFilter'

describe('sanitizeFilterTerm', () => {
  it('strips PostgREST delimiter characters', () => {
    expect(sanitizeFilterTerm('rice, boiled')).toBe('rice boiled')
    expect(sanitizeFilterTerm('dal (fry)')).toBe('dal fry')
    expect(sanitizeFilterTerm('a"b\\c')).toBe('a b c')
  })

  it('collapses whitespace and trims', () => {
    expect(sanitizeFilterTerm('  aloo   gobi  ')).toBe('aloo gobi')
  })
})

/** Every `%…%` pattern in a filter — i.e. everything derived from user input. */
const ilikePatterns = (filter: string): string[] =>
  Array.from(filter.matchAll(/name\.ilike\.%([^%]*)%/g)).map((m) => m[1])

describe('buildNameIlikeOrFilter', () => {
  it('builds a valid or-filter for plain terms', () => {
    expect(buildNameIlikeOrFilter(['dal', 'daal'])).toBe('name.ilike.%dal%,name.ilike.%daal%')
  })

  it('matches each word independently so word order does not matter', () => {
    // Regression: `%bhutta corn%` demanded the words be adjacent and in order,
    // so "bhutta corn" found nothing while "bhutta" found Bhutta (Roasted Corn).
    expect(buildNameIlikeOrFilter(['bhutta corn'])).toBe(
      'and(name.ilike.%bhutta%,name.ilike.%corn%)'
    )
  })

  it('a comma in a user query cannot split the filter (regression: "rice, boiled" → 500)', () => {
    const filter = buildNameIlikeOrFilter(['rice, boiled'])
    // The comma became a space, so this is one AND group over two words —
    // not two sibling conditions at the top level.
    expect(filter).toBe('and(name.ilike.%rice%,name.ilike.%boiled%)')
  })

  it('neutralizes filter-injection attempts', () => {
    // The payload tries to close the ilike value and append its own condition.
    // Sanitization strips every PostgREST delimiter before the filter is built,
    // so the only `,`/`(`/`)` in the output are the ones WE emit for grouping —
    // the payload can never become a condition of its own.
    const filter = buildNameIlikeOrFilter(['x%),id.not.is.null,or(name.ilike.(%'])
    for (const pattern of ilikePatterns(filter)) {
      expect(pattern).not.toMatch(/[,()"\\]/)
    }
    // Grouping is limited to a single, well-formed and(...) we generated.
    expect(filter.startsWith('and(')).toBe(true)
    expect(filter.endsWith(')')).toBe(true)
    expect((filter.match(/\(/g) ?? []).length).toBe(1)
  })

  it('bounds how many words a single term can expand to', () => {
    const filter = buildNameIlikeOrFilter(['one two three four five six'])
    expect(ilikePatterns(filter)).toEqual(['one', 'two', 'three', 'four'])
  })

  it('keeps a term made only of single characters as a literal pattern', () => {
    expect(buildNameIlikeOrFilter(['a b'])).toBe('name.ilike.%a b%')
  })

  it('caps the number of terms and drops empty ones', () => {
    const filter = buildNameIlikeOrFilter(['aa', '', ',,', 'bb', 'cc', 'dd', 'ee', 'ff', 'gg'], 6)
    expect(ilikePatterns(filter)).toEqual(['aa', 'bb', 'cc', 'dd', 'ee', 'ff'])
    expect(filter).not.toContain('%%')
  })

  it('returns empty string when nothing survives sanitization', () => {
    expect(buildNameIlikeOrFilter([',()'])).toBe('')
  })
})
