/**
 * lib/open-food-facts.ts
 * Helpers for fetching food data from Open Food Facts.
 * No SDK or API key required — free REST API.
 * Priority: OFF India first (better coverage of Indian brands),
 * then world as fallback.
 */

export type OFFFood = {
  name: string
  brand: string | null
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  fiber_per_100g: number
  serving_size: string
  source: 'open_food_facts'
  /** Stable ID for deduplication: barcode prefixed with region */
  source_id: string
}

/**
 * The outcome of one OFF query.
 *
 * `ok` distinguishes "OFF answered, and had nothing" from "OFF never answered".
 * Both used to come back as a bare `[]`, so a timeout on a slow phone connection
 * looked identical to a genuine miss — and the caller happily cached it. That is
 * how a food could be invisible on mobile and visible on desktop minutes apart.
 */
export type OFFSearchResult = {
  foods: OFFFood[]
  /** False when the request timed out, errored, or returned a non-2xx. */
  ok: boolean
}

type OFFProduct = {
  code?: string
  product_name?: string
  brands?: string
  serving_size?: string
  nutriments?: {
    'energy-kcal_100g'?: number
    'energy_100g'?: number
    'proteins_100g'?: number
    'carbohydrates_100g'?: number
    'fat_100g'?: number
    'fiber_100g'?: number
  }
}

function parseProduct(p: OFFProduct, idPrefix: string): OFFFood | null {
  const name = p.product_name?.trim()
  if (!name) return null

  const n = p.nutriments ?? {}
  const calories_per_100g =
    n['energy-kcal_100g'] ??
    (n['energy_100g'] ? Math.round(n['energy_100g'] / 4.184) : 0)
  const protein_per_100g = n['proteins_100g'] ?? 0
  const carbs_per_100g = n['carbohydrates_100g'] ?? 0
  const fat_per_100g = n['fat_100g'] ?? 0

  // Skip entries with no usable nutrition data
  if (calories_per_100g === 0 && protein_per_100g === 0 && carbs_per_100g === 0 && fat_per_100g === 0) {
    return null
  }

  const source_id = p.code
    ? `${idPrefix}_${p.code}`
    : `${idPrefix}_name_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60)}`

  return {
    name,
    brand: p.brands?.split(',')[0]?.trim() || null,
    calories_per_100g,
    protein_per_100g,
    carbs_per_100g,
    fat_per_100g,
    fiber_per_100g: n['fiber_100g'] ?? 0,
    serving_size: p.serving_size ?? '100g',
    source: 'open_food_facts',
    source_id,
  }
}

async function fetchOFF(
  baseUrl: string,
  query: string,
  idPrefix: string,
  pageSize = 15
): Promise<OFFSearchResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000)
  try {
    const url =
      `${baseUrl}/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
      `&search_simple=1&action=process&json=1` +
      `&fields=code,product_name,brands,serving_size,nutriments` +
      `&page_size=${pageSize}&sort_by=unique_scans_n`
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'GetInShape/1.0 (getinshape.app, Indian calorie tracker)' },
    })
    if (!res.ok) return { foods: [], ok: false }
    const data = (await res.json()) as { products?: OFFProduct[] }
    const foods = (data.products ?? [])
      .map((p) => parseProduct(p, idPrefix))
      .filter((f): f is OFFFood => f !== null)
    return { foods, ok: true }
  } catch {
    // Abort (5 s timeout), DNS/TLS failure, or malformed JSON — we simply don't
    // know what OFF holds for this query, so say so rather than implying "none".
    return { foods: [], ok: false }
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Search Open Food Facts India — best for Indian packaged & branded foods
 * (Amul, Britannia, MTR, Haldiram's, Maggi, Patanjali, etc.)
 */
export function searchOpenFoodFactsIndia(query: string): Promise<OFFSearchResult> {
  return fetchOFF('https://in.openfoodfacts.org', query, 'offi', 15)
}

/**
 * Search Open Food Facts worldwide — fallback for international products.
 */
export function searchOpenFoodFacts(query: string): Promise<OFFSearchResult> {
  return fetchOFF('https://world.openfoodfacts.org', query, 'off', 10)
}
