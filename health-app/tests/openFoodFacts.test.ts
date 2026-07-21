import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { searchOpenFoodFacts, searchOpenFoodFactsIndia } from '../lib/open-food-facts'

/**
 * These tests exist because of a real bug: `fetchOFF` used to return a bare `[]`
 * for a timeout, a 500 and a genuine empty result alike. The search route cached
 * that for two minutes across all users, so a food (Coca-Cola, in the report)
 * could be invisible on a phone with a flaky connection and visible on desktop.
 * The `ok` flag is what lets the route tell those apart — keep it honest.
 */

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const product = (code: string, name: string) => ({
  code,
  product_name: name,
  brands: 'Coca-Cola',
  serving_size: '330 ml',
  nutriments: { 'energy-kcal_100g': 42, proteins_100g: 0, carbohydrates_100g: 10.6, fat_100g: 0 },
})

describe('open food facts client', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => vi.restoreAllMocks())

  it('reports ok with parsed foods on a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(json({ products: [product('5449000000996', 'Coca-Cola')] }))
    )

    const result = await searchOpenFoodFacts('coca cola')
    expect(result.ok).toBe(true)
    expect(result.foods.map((f) => f.name)).toEqual(['Coca-Cola'])
  })

  it('reports ok with no foods when OFF genuinely has nothing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ products: [] })))

    const result = await searchOpenFoodFacts('zzzznotafood')
    expect(result).toEqual({ foods: [], ok: true })
  })

  it('reports NOT ok when the request throws (timeout, DNS, aborted fetch)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')))

    const result = await searchOpenFoodFactsIndia('coca cola')
    expect(result.ok).toBe(false)
    expect(result.foods).toEqual([])
  })

  it('reports NOT ok on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({}, 503)))

    const result = await searchOpenFoodFacts('coca cola')
    expect(result.ok).toBe(false)
  })

  it('reports NOT ok when the body is not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>gateway error', { status: 200 })))

    const result = await searchOpenFoodFacts('coca cola')
    expect(result.ok).toBe(false)
  })

  it('distinguishes a failure from an empty result — the whole point', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ products: [] })))
    const empty = await searchOpenFoodFacts('q')

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const failed = await searchOpenFoodFacts('q')

    expect(empty.foods).toEqual(failed.foods)
    expect(empty.ok).not.toBe(failed.ok)
  })
})
