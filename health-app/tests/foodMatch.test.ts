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

/**
 * The camera/chat half of the "moong daal" scar. Gemini reports a food by name
 * only, so when it says "Moong Daal" the packet's name matches character for
 * character (score 4) while the measured "Moong Dal (Yellow)" merely contains
 * it (score 2) — and the log lands at ~517 kcal/100 g instead of ~104.
 * `pickBestFoodMatch` weights name quality x10 over SOURCE_RANK, so source
 * trust cannot rescue it. Score the packet against its whole identity instead.
 */
describe('pickBestFoodMatch with a branded row', () => {
  const namkeen = { name: 'Moong Daal', source: 'off_india', brand: "Haldiram's" }
  const measured = { name: 'Moong Dal (Yellow)', source: 'ifct', brand: null }

  it('does not resolve a home-cooked dish to a same-named packet', () => {
    expect(pickBestFoodMatch([namkeen, measured], 'Moong Daal')?.name).toBe('Moong Dal (Yellow)')
    expect(pickBestFoodMatch([namkeen, measured], 'moong dal')?.name).toBe('Moong Dal (Yellow)')
  })

  it('still resolves to the packet when the brand is named', () => {
    expect(pickBestFoodMatch([namkeen, measured], "Haldiram's Moong Daal")?.name).toBe('Moong Daal')
  })

  it('leaves a brandless row scoring exactly as before', () => {
    const rows = [
      { name: 'Gits Dal Tadka (Ready to Eat)', source: 'branded' },
      { name: 'Dal', source: 'ifct' },
    ]
    expect(pickBestFoodMatch(rows, 'dal')?.name).toBe('Dal')
  })
})
