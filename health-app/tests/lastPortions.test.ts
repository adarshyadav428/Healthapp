import { describe, it, expect } from 'vitest'
import { lastPortionsFrom } from '../lib/lastPortions'

describe('lastPortionsFrom', () => {
  it('keeps the newest portion per food (rows arrive newest first)', () => {
    const map = lastPortionsFrom([
      { food_id: 'rice', grams: 150, kcal: 195, meal: 'lunch' },
      { food_id: 'dal', grams: 200, kcal: 220, meal: 'dinner' },
      { food_id: 'rice', grams: 300, kcal: 390, meal: 'dinner' },
    ])
    expect(map.rice).toEqual({ grams: 150, kcal: 195, meal: 'lunch' })
    expect(map.dal).toEqual({ grams: 200, kcal: 220, meal: 'dinner' })
  })

  it('ignores rows that carry no portion', () => {
    // Quick-adds (calories only) have no food and no grams; a 0 g row must
    // never become the amount "+" re-logs.
    const map = lastPortionsFrom([
      { food_id: null, grams: null, kcal: 300, meal: 'snack' },
      { food_id: 'chai', grams: 0, kcal: 0, meal: 'snack' },
      { food_id: 'chai', grams: 150, kcal: 90, meal: 'breakfast' },
    ])
    expect(Object.keys(map)).toEqual(['chai'])
    expect(map.chai.grams).toBe(150)
  })

  it('returns an empty map for a user with no history', () => {
    expect(lastPortionsFrom([])).toEqual({})
  })
})
