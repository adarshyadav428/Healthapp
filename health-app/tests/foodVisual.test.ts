import { describe, it, expect } from 'vitest'
import { foodEmoji } from '../lib/foodVisual'

/**
 * The emoji rules are substring matches over a food's name, and a Hindi word
 * hiding inside another word picks the wrong picture: "Poha (Kanda)" — onion
 * poha, one of the most-logged breakfasts in the catalogue — carried an egg on
 * Home because `anda` sat inside "K**anda**". Same failure class as the
 * SMART_PORTIONS scars in lib/portion-units.ts, pinned the same way.
 */
describe('foodEmoji', () => {
  it('does not read "anda" out of Kanda', () => {
    expect(foodEmoji('Poha (Kanda)')).not.toBe('🥚')
    expect(foodEmoji('Kanda Poha')).not.toBe('🥚')
  })

  it('still recognises a real egg dish, in English and Hindi', () => {
    expect(foodEmoji('Boiled Egg')).toBe('🥚')
    expect(foodEmoji('Anda Bhurji')).toBe('🥚')
    expect(foodEmoji('Boiled Anda')).toBe('🥚')
  })
})
