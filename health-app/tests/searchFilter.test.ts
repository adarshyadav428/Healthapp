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

describe('buildNameIlikeOrFilter', () => {
  it('builds a valid or-filter for plain terms', () => {
    expect(buildNameIlikeOrFilter(['dal', 'daal'])).toBe('name.ilike.%dal%,name.ilike.%daal%')
  })

  it('a comma in a user query cannot split the filter (regression: "rice, boiled" → 500)', () => {
    const filter = buildNameIlikeOrFilter(['rice, boiled'])
    expect(filter).toBe('name.ilike.%rice boiled%')
    // exactly one condition — the comma did not create a second, malformed one
    expect(filter.split(',').length).toBe(1)
  })

  it('neutralizes filter-injection attempts', () => {
    // The payload tries to close the ilike value and append its own condition.
    // After sanitization it must survive only as text INSIDE a single ilike
    // pattern — no `,`/`(`/`)` means PostgREST cannot see a second condition.
    const filter = buildNameIlikeOrFilter(['x%),id.not.is.null,or(name.ilike.(%'])
    expect(filter.split(',').length).toBe(1) // exactly one condition
    expect(filter).not.toMatch(/[()]/) // no grouping tokens survive
    expect(filter.startsWith('name.ilike.%')).toBe(true)
  })

  it('caps the number of terms and drops empty ones', () => {
    const filter = buildNameIlikeOrFilter(['a', '', ',,', 'b', 'c', 'd', 'e', 'f', 'g'], 6)
    expect(filter.split(',').length).toBe(6)
    expect(filter).not.toContain('%%')
  })

  it('returns empty string when nothing survives sanitization', () => {
    expect(buildNameIlikeOrFilter([',()'])).toBe('')
  })
})
