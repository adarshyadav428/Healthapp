import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '../../../../lib/supabase/server'
import type { Food } from '../../../../types/index'

export const runtime = 'nodejs'

const rateMap = new Map<string, { count: number; reset: number }>()
const searchCache = new Map<string, { data: Food[]; expires: number }>()
const CACHE_TTL_MS = 120_000
const CACHE_MAX = 200
const FOOD_SELECT =
  'id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g'

function rateLimit(ip: string, limit = 30, windowMs = 60_000) {
  const now = Date.now()
  const entry = rateMap.get(ip)
  if (!entry || entry.reset < now) {
    rateMap.set(ip, { count: 1, reset: now + windowMs })
    return false
  }
  if (entry.count >= limit) return true
  entry.count += 1
  return false
}

function getCached(query: string) {
  const entry = searchCache.get(query)
  if (!entry) return null
  if (entry.expires < Date.now()) {
    searchCache.delete(query)
    return null
  }
  return entry.data
}

function setCached(query: string, data: Food[]) {
  if (searchCache.size >= CACHE_MAX) {
    const oldestKey = searchCache.keys().next().value as string | undefined
    if (oldestKey) searchCache.delete(oldestKey)
  }
  searchCache.set(query, { data, expires: Date.now() + CACHE_TTL_MS })
}

/** Score a food name for relevance against the query (higher = better match). */
function relevanceScore(name: string, query: string): number {
  const n = name.toLowerCase()
  const q = query.toLowerCase()
  if (n === q) return 4
  if (n.startsWith(q)) return 3
  if (n.split(/[\s/,(]+/).some((w) => w.startsWith(q))) return 2
  return 1
}

type ExternalFood = Omit<Food, 'id'> & { source_id: string }

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

function parseServingGrams(s: string | undefined): number {
  if (!s) return 100
  const m = s.match(/(\d+(?:\.\d+)?)\s*g/i)
  return m ? Math.round(parseFloat(m[1])) : 100
}

function offProductToFood(p: OFFProduct, prefix: string): ExternalFood | null {
  const name = p.product_name?.trim()
  if (!name) return null

  const n = p.nutriments ?? {}
  const kcal =
    n['energy-kcal_100g'] ??
    (n['energy_100g'] ? Math.round(n['energy_100g'] / 4.184) : 0)
  const protein = n['proteins_100g'] ?? 0
  const carbs = n['carbohydrates_100g'] ?? 0
  const fat = n['fat_100g'] ?? 0

  // Reject entries with no usable nutrition data at all
  if (kcal === 0 && protein === 0 && carbs === 0 && fat === 0) return null

  const stableId = p.code
    ? `${prefix}_${p.code}`
    : `${prefix}_name_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60)}`

  return {
    source: 'off' as const,
    source_id: stableId,
    name,
    brand: p.brands?.split(',')[0]?.trim() || null,
    serving_size_g: parseServingGrams(p.serving_size),
    serving_description: p.serving_size ?? '100g',
    kcal_per_100g: kcal,
    protein_g_per_100g: protein,
    carbs_g_per_100g: carbs,
    fat_g_per_100g: fat,
    fiber_g_per_100g: n['fiber_100g'] ?? null,
  }
}

/** Search Open Food Facts India — best source for Indian packaged & branded foods */
async function fetchOFFIndia(query: string): Promise<ExternalFood[]> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    const url =
      `https://in.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
      `&action=process&json=true&fields=code,product_name,brands,serving_size,nutriments` +
      `&page_size=15&sort_by=unique_scans_n`
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'GetInShape/1.0 (getinshape.app, Indian calorie tracker)' },
    })
    clearTimeout(timeoutId)
    if (!res.ok) return []
    const json = (await res.json()) as { products?: OFFProduct[] }
    return (json.products ?? [])
      .map((p) => offProductToFood(p, 'offi'))
      .filter((f): f is ExternalFood => f !== null)
  } catch {
    return []
  }
}

/** Search Open Food Facts worldwide — fallback for international packaged items */
async function fetchOFFWorld(query: string): Promise<ExternalFood[]> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    const url =
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
      `&action=process&json=true&fields=code,product_name,brands,serving_size,nutriments` +
      `&page_size=10&sort_by=unique_scans_n`
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'GetInShape/1.0 (getinshape.app, Indian calorie tracker)' },
    })
    clearTimeout(timeoutId)
    if (!res.ok) return []
    const json = (await res.json()) as { products?: OFFProduct[] }
    return (json.products ?? [])
      .map((p) => offProductToFood(p, 'off'))
      .filter((f): f is ExternalFood => f !== null)
  } catch {
    return []
  }
}

/**
 * Persist external foods to DB and return them with their actual DB UUIDs.
 * - Foods already cached in DB are returned with their existing UUID.
 * - New foods are inserted (DB generates UUID) and returned with the real UUID.
 */
async function persistExternalFoods(externals: ExternalFood[]): Promise<Food[]> {
  if (externals.length === 0) return []
  const admin = createAdminClient()

  const unique = Array.from(new Map(externals.map((f) => [f.source_id, f])).values())
  const sourceIds = unique.map((f) => f.source_id)

  const { data: existing } = await admin
    .from('foods')
    .select(FOOD_SELECT)
    .in('source_id', sourceIds)

  const existingMap = new Map((existing ?? []).map((r) => [(r as Food).source_id, r as Food]))

  const toInsert = unique.filter((f) => !existingMap.has(f.source_id))
  if (toInsert.length > 0) {
    const { data: inserted } = await admin
      .from('foods')
      .insert(toInsert)
      .select(FOOD_SELECT)
    ;(inserted ?? []).forEach((r) => existingMap.set((r as Food).source_id, r as Food))
  }

  return unique
    .map((f) => existingMap.get(f.source_id))
    .filter((f): f is Food => f !== undefined)
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    if (!query) return NextResponse.json([])

    const normalizedQuery = query.toLowerCase()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (rateLimit(ip)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const supabase = createServerClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const cached = getCached(normalizedQuery)
    if (cached) return NextResponse.json(cached)

    const shouldFetchExternal = query.length >= 3

    // Search order: local IFCT DB (most accurate for Indian foods)
    // → OFF India (Indian packaged/branded products)
    // → OFF World (international products)
    // USDA intentionally removed — US-centric data is inaccurate for Indian foods
    const [localResult, offIndiaRaw, offWorldRaw] = await Promise.all([
      supabase.from('foods').select(FOOD_SELECT).ilike('name', `%${query}%`).limit(20),
      shouldFetchExternal ? fetchOFFIndia(query) : Promise.resolve([]),
      shouldFetchExternal ? fetchOFFWorld(query) : Promise.resolve([]),
    ])

    if (localResult.error) throw new Error(localResult.error.message)
    const rawLocal = (localResult.data ?? []) as Food[]

    // Sort local results by relevance
    const localResults = rawLocal.slice().sort((a, b) => {
      const diff = relevanceScore(b.name, query) - relevanceScore(a.name, query)
      return diff !== 0 ? diff : a.name.localeCompare(b.name)
    })

    // Deduplicate externals against local results
    const localSourceIdSet = new Set(localResults.map((f) => f.source_id))

    // OFF India first, then world — deduplicate by source_id
    const seenExternalIds = new Set<string>()
    const externalRaw: ExternalFood[] = []
    for (const f of [...offIndiaRaw, ...offWorldRaw]) {
      if (!localSourceIdSet.has(f.source_id) && !seenExternalIds.has(f.source_id)) {
        seenExternalIds.add(f.source_id)
        externalRaw.push(f)
      }
    }

    const externalWithIds = await persistExternalFoods(externalRaw)

    // Merge: local IFCT → OFF India → OFF World
    const combined = [...localResults, ...externalWithIds]
    const deduped = new Map<string, Food>()
    for (const food of combined) {
      const key = `${food.name.toLowerCase().replace(/\s+/g, ' ')}-${(food.brand ?? '').toLowerCase()}`
      if (!deduped.has(key)) deduped.set(key, food)
    }

    const result = Array.from(deduped.values()).slice(0, 20)
    setCached(normalizedQuery, result)
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
