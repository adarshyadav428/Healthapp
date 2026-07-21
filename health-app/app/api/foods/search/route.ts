import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient, getApiUser } from '../../../../lib/supabase/server'
import { searchOpenFoodFactsIndia, searchOpenFoodFacts } from '../../../../lib/open-food-facts'
import { expandSearchQuery } from '../../../../lib/food-synonyms'
import { buildNameIlikeOrFilter } from '../../../../lib/searchFilter'
import { isPlausibleFood, SOURCE_RANK } from '../../../../lib/foodMatch'
import { dedupeFoodsByNameBrand } from '../../../../lib/mergeSearchResults'
import { INDIAN_FOODS } from '../../../../lib/indian-foods-data'
import { CURATED_FOODS } from '../../../../lib/curated-foods-data'
import type { Food } from '../../../../types/index'

export const runtime = 'nodejs'

const rateMap = new Map<string, { count: number; reset: number }>()
const searchCache = new Map<string, { data: Food[]; expires: number }>()
const CACHE_TTL_MS = 120_000
const CACHE_MAX = 200
const FOOD_SELECT =
  'id, source, source_id, name, brand, serving_size_g, serving_description, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, fiber_g_per_100g, common_portions'

// ── Auto-seed ────────────────────────────────────────────────────────────────
// If the foods table has fewer IFCT entries than our seed file, upsert them all.
// Runs at most once per server instance (module-level flag). Idempotent.
let autoSeedDone = false

async function autoSeedIfNeeded(): Promise<void> {
  if (autoSeedDone) return
  // `next build` invokes this handler once while deciding whether the route can
  // be statically rendered, which means a plain `npm run build` would write
  // every seed row into whatever database .env.local points at — including
  // production, from any laptop or CI job. Seeding is a request-time concern.
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  autoSeedDone = true // optimistic — prevents parallel calls within one server instance
  try {
    const admin = createAdminClient()
    // Always upsert all seed entries — idempotent via ON CONFLICT source,source_id.
    // Previously this was gated on count >= INDIAN_FOODS.length, but that caused
    // items added to the seed file after migrations ran to never reach the DB.
    // IFCT first, then the curated long tail (regional biryanis, street food,
    // packaged brands) that IFCT doesn't cover.
    const BATCH = 50
    const seeds = [...INDIAN_FOODS, ...CURATED_FOODS]
    for (let i = 0; i < seeds.length; i += BATCH) {
      await admin
        .from('foods')
        .upsert(seeds.slice(i, i + BATCH), { onConflict: 'source,source_id', ignoreDuplicates: true })
    }
  } catch (e) {
    autoSeedDone = false // allow retry next request
    console.error('[auto-seed] failed:', e)
  }
}

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
    common_portions: null, // OFF foods use name-based unit inference in AddFoodModal
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
  // Fire-and-forget: populate IFCT foods on first ever search (idempotent)
  autoSeedIfNeeded().catch(() => {})

  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim()
    if (!query) return NextResponse.json([])

    const normalizedQuery = query.toLowerCase()

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    if (rateLimit(ip)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

    const supabase = createServerClient()
    const user = await getApiUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Expand query with Indian food synonyms (e.g. "arhar" → also searches "toor dal")
    const synonymQueries = expandSearchQuery(query)

    // Build Supabase OR filter across all synonym variants (cap at 6 to keep
    // query fast). Terms are sanitized — PostgREST's or= syntax is
    // comma/paren-delimited, so raw ",()" in a query would corrupt the filter.
    const orFilter = buildNameIlikeOrFilter(synonymQueries, 6)
    if (!orFilter) return NextResponse.json([])

    // The current user's own AI-estimate foods they've logged before. Estimate
    // rows are hidden from the shared results below (they're per-user AI guesses
    // living in a shared table), but a food *you* scanned or chat-logged should be
    // findable again — scoped to you via food_logs, never leaked to other users.
    // Fetched fresh every request and deliberately NOT cached, since the query
    // cache below is shared across all users.
    const { data: myEstimateLogs } = await supabase
      .from('food_logs')
      .select(`food_id, food:foods!inner(${FOOD_SELECT})`)
      .eq('user_id', user.id)
      .eq('foods.source', 'estimate')
      .or(orFilter, { referencedTable: 'foods' })
      .order('logged_at', { ascending: false })
      .limit(50)

    const seenEstimateIds = new Set<string>()
    const myEstimateFoods: Food[] = []
    for (const row of (myEstimateLogs ?? []) as unknown as { food_id: string; food: Food | null }[]) {
      if (row.food && !seenEstimateIds.has(row.food_id)) {
        seenEstimateIds.add(row.food_id)
        myEstimateFoods.push(row.food)
      }
    }

    // Global (user-independent) results — cached and shared across all users.
    let globalResults = getCached(normalizedQuery)
    if (!globalResults) {
      const shouldFetchExternal = query.length >= 3

      // Search order: local IFCT DB (synonym-expanded, most accurate for Indian foods)
      // → OFF India (Indian packaged/branded products: Amul, Britannia, MTR, etc.)
      // → OFF World (international products)
      // USDA intentionally removed — US-centric data is inaccurate for Indian foods
      const [localResult, offIndiaRaw, offWorldRaw] = await Promise.all([
        // Exclude `estimate` rows — those are per-user AI guesses written during
        // chat/camera logging into the shared table; they must not surface in the
        // shared results (the user's own ones are merged back in per-request below).
        // Fetch generously (60, not 20): the table now holds ~870 seeded rows,
        // and Postgres applies LIMIT before our relevance/source sort below —
        // so a tight limit would hand back an arbitrary slice and could cut the
        // measured IFCT row out of a broad query like "rice" entirely.
        // `dedupeFoodsByNameBrand` caps the response at 20 regardless.
        supabase.from('foods').select(FOOD_SELECT).or(orFilter).neq('source', 'estimate').limit(60),
        shouldFetchExternal ? searchOpenFoodFactsIndia(synonymQueries[0]) : Promise.resolve([]),
        shouldFetchExternal ? searchOpenFoodFacts(synonymQueries[0]) : Promise.resolve([]),
      ])

      if (localResult.error) throw new Error(localResult.error.message)
      const rawLocal = (localResult.data ?? []) as Food[]

      // Sort local results by relevance, then by how much we trust the source.
      // The source tie-break matters because the table holds both measured IFCT
      // rows and estimated `curated` ones — without it, two rows scoring the
      // same on name would be ordered by name alone, and `dedupeFoodsByNameBrand`
      // (which keeps the first occurrence) could drop the measured row.
      const localResults = rawLocal.slice().sort((a, b) => {
        const byRelevance = relevanceScore(b.name, query) - relevanceScore(a.name, query)
        if (byRelevance !== 0) return byRelevance
        const bySource = (SOURCE_RANK[b.source] ?? 0) - (SOURCE_RANK[a.source] ?? 0)
        if (bySource !== 0) return bySource
        return a.name.localeCompare(b.name)
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

      // Merge: local IFCT → OFF India → OFF World. Drop physically-impossible
      // rows (bad OFF data: 0-kcal solids, >100 g macros/100 g) before dedupe.
      globalResults = dedupeFoodsByNameBrand([...localResults, ...externalWithIds].filter(isPlausibleFood))
      setCached(normalizedQuery, globalResults)
    }

    // Append the user's own estimate foods after the shared results. Global rows
    // win a name+brand collision (an accurate IFCT/OFF row beats a rough
    // estimate), so this only surfaces scans/chat foods the shared DB lacks.
    const finalResult = dedupeFoodsByNameBrand([...globalResults, ...myEstimateFoods].filter(isPlausibleFood))
    return NextResponse.json(finalResult)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
