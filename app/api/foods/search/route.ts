import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '../../../../lib/supabase/server'
import { searchOpenFoodFactsIndia, searchOpenFoodFacts } from '../../../../lib/open-food-facts'
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

function parseServingGrams(s: string | undefined): number {
  if (!s) return 100
  const m = s.match(/(\d+(?:\.\d+)?)\s*g/i)
  return m ? Math.round(parseFloat(m[1])) : 100
}

/** Convert OFFFood (from lib/open-food-facts) to the DB-compatible ExternalFood shape */
function offToExternal(f: Awaited<ReturnType<typeof searchOpenFoodFacts>>[number]): ExternalFood {
  return {
    source: 'off' as const,
    source_id: f.source_id,
    name: f.name,
    brand: f.brand,
    serving_size_g: parseServingGrams(f.serving_size),
    serving_description: f.serving_size,
    kcal_per_100g: f.calories_per_100g,
    protein_g_per_100g: f.protein_per_100g,
    carbs_g_per_100g: f.carbs_per_100g,
    fat_g_per_100g: f.fat_per_100g,
    fiber_g_per_100g: f.fiber_per_100g || null,
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
    // → OFF India (Indian packaged/branded products: Amul, Britannia, MTR, etc.)
    // → OFF World (international products)
    // USDA intentionally removed — US-centric data is inaccurate for Indian foods
    const [localResult, offIndiaRaw, offWorldRaw] = await Promise.all([
      supabase.from('foods').select(FOOD_SELECT).ilike('name', `%${query}%`).limit(20),
      shouldFetchExternal ? searchOpenFoodFactsIndia(query) : Promise.resolve([]),
      shouldFetchExternal ? searchOpenFoodFacts(query) : Promise.resolve([]),
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

    // OFF India first, then world — map to ExternalFood shape and deduplicate
    const seenExternalIds = new Set<string>()
    const externalRaw: ExternalFood[] = []
    for (const f of [...offIndiaRaw.map(offToExternal), ...offWorldRaw.map(offToExternal)]) {
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
