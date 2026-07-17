import { describe, it, expect } from 'vitest'
import { pickBestFoodMatch, isPlausibleFood } from '../lib/foodMatch'

const macros = { protein_g_per_100g: 5, carbs_g_per_100g: 20, fat_g_per_100g: 3 }

describe('pickBestFoodMatch', () => {
  it('prefers IFCT over branded at equal name quality (the roti/dal bug)', () => {
    const rows = [
      { name: 'Gits Dal Tadka (Ready to Eat)', source: 'branded' },
      { name: 'Dal', source: 'ifct' },
    ]
    expect(pickBestFoodMatch(rows, 'dal')?.name).toBe('Dal')
  })

  it('prefers an exact/prefix name over a mere substring match', () => {
    const rows = [
      { name: 'Bajra Roti (Pearl Millet Flatbread)', source: 'ifct' },
      { name: 'Roti', source: 'ifct' },
    ]
    expect(pickBestFoodMatch(rows, 'roti')?.name).toBe('Roti')
  })

  it('returns null for an empty candidate list', () => {
    expect(pickBestFoodMatch([], 'roti')).toBeNull()
  })
})

describe('isPlausibleFood', () => {
  it('accepts normal foods', () => {
    expect(isPlausibleFood({ kcal_per_100g: 130, ...macros })).toBe(true)
  })

  it('rejects >100 g of macros per 100 g (e.g. "163 g carbs")', () => {
    expect(isPlausibleFood({ kcal_per_100g: 722, protein_g_per_100g: 10, carbs_g_per_100g: 163, fat_g_per_100g: 5 })).toBe(false)
  })

  it('rejects a solid food reported as 0 kcal', () => {
    expect(isPlausibleFood({ kcal_per_100g: 0, ...macros })).toBe(false)
  })

  it('keeps a genuinely ~0-kcal item (water/black coffee)', () => {
    expect(isPlausibleFood({ kcal_per_100g: 0, protein_g_per_100g: 0, carbs_g_per_100g: 0, fat_g_per_100g: 0 })).toBe(true)
  })
})
