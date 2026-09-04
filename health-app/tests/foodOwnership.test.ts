import { describe, expect, it } from 'vitest'
import { isFoodReferenceableBy } from '../lib/foodOwnership'

const USER_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

describe('isFoodReferenceableBy()', () => {
  it('is referenceable by anyone when the food is not a custom food', () => {
    for (const source of ['ifct', 'restaurant', 'branded', 'off', 'off_india', 'off_world', 'curated', 'estimate']) {
      expect(isFoodReferenceableBy({ source, source_id: 'anything' }, USER_A)).toBe(true)
      expect(isFoodReferenceableBy({ source, source_id: null }, USER_B)).toBe(true)
    }
  })

  it('is referenceable by its creator', () => {
    const food = { source: 'user', source_id: `user_${USER_A}_1730000000000` }
    expect(isFoodReferenceableBy(food, USER_A)).toBe(true)
  })

  it('is NOT referenceable by a different user — the P0-2 case', () => {
    const food = { source: 'user', source_id: `user_${USER_A}_1730000000000` }
    expect(isFoodReferenceableBy(food, USER_B)).toBe(false)
  })

  it('is not referenceable by anyone when source_id is missing or malformed', () => {
    expect(isFoodReferenceableBy({ source: 'user', source_id: null }, USER_A)).toBe(false)
    expect(isFoodReferenceableBy({ source: 'user', source_id: '' }, USER_A)).toBe(false)
    // A prefix collision must not pass — user A's id must not be a mere
    // substring match of a longer, different id.
    expect(
      isFoodReferenceableBy({ source: 'user', source_id: `user_${USER_A}extra_1` }, USER_A)
    ).toBe(false)
  })
})
