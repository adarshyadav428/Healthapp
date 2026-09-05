import { NextResponse } from 'next/server'
import { createServerClient, createAdminClient, getApiUser } from '../../../../lib/supabase/server'
import {
  searchOpenFoodFactsIndia,
  searchOpenFoodFacts,
  type OFFFood,
  type OFFSearchResult,
} from '../../../../lib/open-food-facts'
import { TtlCache } from '../../../../lib/searchCache'
import { compareFoodsForQuery, queryNamesBrand } from '../../../../lib/searchRanking'
import { expandSearchQuery } from '../../../../lib/food-synonyms'
import { correctFoodQuery } from '../../../../lib/typo-correction'
import { buildNameIlikeOrFilter } from '../../../../lib/searchFilter'
import { isPlausibleFood, SOURCE_RANK } from '../../../../lib/foodMatch'
import {
  collapseDuplicateFoods,
  capOpenFoodFactsDominance,
  dropForeignWhenIndianExists,
  MAX_OFF_WITHOUT_BRAND,
  MAX_SEARCH_RESULTS,
} from '../../../../lib/mergeSearchResults'
import { INDIAN_FOODS } from '../../../../lib/indian-foods-data'
import { CURATED_FOODS } from '../../../../lib/curated-foods-data'
import type { Food } from '../../../../types/index'

export const runtime = 'nodejs'

const rateMap = new Map<string, { count: number; reset: number }>()
/** Slots held back for a user's own camera/chat/custom foods so a full page of
 *  shared results can't squeeze them out entirely. */
const RESERVED_OWN_FOOD_SLOTS = 3
const searchCache = new TtlCache<Food[]>(200)
const CACHE_TTL_MS = 120_000
/**
 * TTL for a result assembled while Open Food Facts was unreachable. Such a
 * result is missing rows rather than genuinely short, and this cache is shared
 * across all users — so it must expire fast enough that the next search retries
 * the upstream, while still absorbing the retry storm of a user typing.
 */
const DEGRADED_CACHE_TTL_MS = 10_000
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

type ExternalFood = Omit<Food, 'id'> & { source_id: string }

function parseServingGrams(s: string | undefined): number {
  if (!s) return 100
  const m = s.match(/(\d+(?:\.\d+)?)\s*g/i)
  return m ? Math.round(parseFloat(m[1])) : 100
}

/** OFF wasn't queried at all (query too short) — an absence, not a failure. */
const OFF_NOT_FETCHED: OFFSearchResult = { foods: [], ok: true }

/** Convert OFFFood (from lib/open-food-facts) to the DB-compatible ExternalFood shape */
function offToExternal(f: OFFFood): ExternalFood {
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

/**
 * The shared, user-independent half of a search: the local catalogue plus both
 * Open Food Facts endpoints, ranked and merged. Everything in here depends on
 * nothing but the query string, which is what lets the route run it a second
 * time with a corrected spelling when the first attempt comes back empty.
 */
async function searchGlobal(
  supabase: ReturnType<typeof createServerClient>,
  query: string
): Promise<{ foods: Food[]; degraded: boolean }> {
  // Expand with Indian food synonyms (e.g. "arhar" → also searches "toor dal"),
  // then build the Supabase OR filter across the variants (capped at 6 to keep
  // the query fast). Terms are sanitized — PostgREST's or= syntax is
  // comma/paren-delimited, so raw ",()" in a query would corrupt the filter.
  const synonymQueries = expandSearchQuery(query)
  const orFilter = buildNameIlikeOrFilter(synonymQueries, 6)
  if (!orFilter) return { foods: [], degraded: false }

  const shouldFetchExternal = query.length >= 3

  // Search order: local IFCT DB (synonym-expanded, most accurate for Indian foods)
  // → OFF India (Indian packaged/branded products: Amul, Britannia, MTR, etc.)
  // → OFF World (international products)
  // USDA intentionally removed — US-centric data is inaccurate for Indian foods
  const [localResult, offIndia, offWorld] = await Promise.all([
    // Exclude `estimate` rows — those are per-user AI guesses written during
    // chat/camera logging into the shared table — and `user` rows — those are
    // Pro-only custom foods a single account created via /api/foods/custom.
    // Neither may surface in the shared results (each user's own are merged
    // back in per-request below, scoped to that user — see myOwnFoods).
    // `user` was NOT excluded here before 2026-09-04: `foods_select`'s RLS
    // policy is deliberately open to every signed-in user (it has to be, for
    // the shared catalogue), so any other account's custom food surfaced on an
    // ordinary partial-word search, badged "👤 Custom" — false for the finder
    // — and could be logged by them. `food_logs.food_id` cascades off `foods`,
    // so the *owner* later deleting their own food, completely ordinary
    // behaviour, silently deleted the other account's diary entry too. Audit
    // 2026-09-04, P0-2.
    // Fetch generously (200, not 20): Postgres applies LIMIT *before* our
    // sort below, so a tight limit hands back an arbitrary slice. Measured
    // at 60 against the live table, "rice" and "dal" returned a different
    // top result than at 200 purely because of where the slice fell.
    // Synonym expansion widens these queries further. The client still gets
    // 20 — `collapseDuplicateFoods` caps the response regardless.
    supabase.from('foods').select(FOOD_SELECT).or(orFilter).neq('source', 'estimate').neq('source', 'user').limit(200),
    shouldFetchExternal
      ? searchOpenFoodFactsIndia(synonymQueries[0])
      : Promise.resolve(OFF_NOT_FETCHED),
    shouldFetchExternal
      ? searchOpenFoodFacts(synonymQueries[0])
      : Promise.resolve(OFF_NOT_FETCHED),
  ])

  if (localResult.error) throw new Error(localResult.error.message)
  const rawLocal = (localResult.data ?? []) as Food[]

  // Name match first, then how much of the name the query explains, then
  // source trust. The source tie-break matters because the table holds both
  // measured IFCT rows and estimated `curated` ones — this ordering feeds
  // `collapseDuplicateFoods` below, which elects the highest-source-rank
  // member of each cluster regardless of this sort, but still uses this
  // order to decide where each surviving cluster sits in the list. See
  // lib/searchRanking.ts for why source rank is scored last.
  // Ranked against every synonym variant, not just the typed word — a row
  // matched only via a synonym would otherwise score zero and be ordered by
  // source alone.
  const localResults = rawLocal.slice().sort(compareFoodsForQuery(synonymQueries, SOURCE_RANK))

  // Deduplicate externals against local results
  const localSourceIdSet = new Set(localResults.map((f) => f.source_id))

  // OFF India first, then world — map to ExternalFood shape and deduplicate
  const seenExternalIds = new Set<string>()
  const externalRaw: ExternalFood[] = []
  for (const f of [...offIndia.foods.map(offToExternal), ...offWorld.foods.map(offToExternal)]) {
    if (!localSourceIdSet.has(f.source_id) && !seenExternalIds.has(f.source_id)) {
      seenExternalIds.add(f.source_id)
      externalRaw.push(f)
    }
  }

  const externalWithIds = await persistExternalFoods(externalRaw)

  // A query that names no brand ("boiled egg") gets a tighter OFF cap than
  // one that does ("amul butter") — see capOpenFoodFactsDominance. Checked
  // against whatever brands this search actually turned up, reusing the same
  // signal compareFoodsForQuery already scores rows against, rather than a
  // second brand-detection path.
  const queryNamesAnyBrand = [...localResults, ...externalWithIds].some((f) =>
    queryNamesBrand(f.brand, query)
  )

  // Merge: local IFCT → OFF India → OFF World. Drop physically-impossible
  // rows (bad OFF data: 0-kcal solids, >100 g macros/100 g), hide products
  // Open Food Facts doesn't list as sold in India when we have an Indian
  // answer, collapse rows that are the same food (SOURCE_RANK decides which
  // survives), then cap Open Food Facts dominance.
  //
  // The foreign filter runs before the cap on purpose: the cap's budget should
  // be spent on rows a user here can actually buy, not on the British
  // supermarket own-brands it would otherwise count first.
  const foods = collapseDuplicateFoods(
    capOpenFoodFactsDominance(
      dropForeignWhenIndianExists(
        [...localResults, ...externalWithIds].filter(isPlausibleFood),
        query
      ),
      queryNamesAnyBrand ? 10 : MAX_OFF_WITHOUT_BRAND
    ),
    SOURCE_RANK
  )

  // Only a result built from healthy upstreams earns the full TTL. If OFF
  // timed out, this list is missing every packaged food we don't already
  // hold locally — the caller caches it briefly so the next search retries
  // rather than serving the gap to every user for two minutes.
  return { foods, degraded: !offIndia.ok || !offWorld.ok }
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
    // 4xx copy is relayed to the user verbatim (lib/apiError.ts), so it has to
    // read like a sentence a person wrote, not a status line.
    if (rateLimit(ip)) {
      return NextResponse.json(
        { error: 'Searching a bit fast — give it a few seconds and try again.' },
        { status: 429 }
      )
    }

    const supabase = createServerClient()
    const user = await getApiUser(supabase)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // The filter for the per-user estimate lookup below. `searchGlobal` builds
    // its own from whatever query it is given — this one always follows what the
    // user actually typed, since your own scans are yours to find by name.
    const orFilter = buildNameIlikeOrFilter(expandSearchQuery(query), 6)
    if (!orFilter) return NextResponse.json([])

    // The current user's own AI-estimate foods they've logged before, and their
    // own Pro-only custom foods (source='user', via /api/foods/custom). Both are
    // excluded from the shared results above — estimate rows are per-user AI
    // guesses living in a shared table, and custom rows are now excluded for the
    // same reason a search must never leak them to a different account (P0-2,
    // see the comment on the local query above) — but each must still be
    // findable by the account that made it. They're scoped differently on
    // purpose: an estimate only exists once logged, so it's scoped via
    // food_logs; a custom food exists as soon as it's created, so it's scoped by
    // ownership directly — the same `source_id LIKE 'user_<uid>_%'` predicate
    // 034_foods_rls_ownership.sql's owns_custom_food() enforces at the database
    // level. Fetched fresh every request and deliberately NOT cached, since the
    // query cache below is shared across all users.
    const [{ data: myEstimateLogs }, { data: myCustomFoods }] = await Promise.all([
      supabase
        .from('food_logs')
        .select(`food_id, food:foods!inner(${FOOD_SELECT})`)
        .eq('user_id', user.id)
        .eq('foods.source', 'estimate')
        .or(orFilter, { referencedTable: 'foods' })
        .order('logged_at', { ascending: false })
        .limit(50),
      supabase
        .from('foods')
        .select(FOOD_SELECT)
        .eq('source', 'user')
        .like('source_id', `user_${user.id}_%`)
        .or(orFilter)
        .limit(50),
    ])

    const seenOwnFoodIds = new Set<string>()
    const myOwnFoods: Food[] = []
    for (const row of (myEstimateLogs ?? []) as unknown as { food_id: string; food: Food | null }[]) {
      if (row.food && !seenOwnFoodIds.has(row.food_id)) {
        seenOwnFoodIds.add(row.food_id)
        myOwnFoods.push(row.food)
      }
    }
    for (const food of (myCustomFoods ?? []) as Food[]) {
      if (!seenOwnFoodIds.has(food.id)) {
        seenOwnFoodIds.add(food.id)
        myOwnFoods.push(food)
      }
    }

    // Global (user-independent) results — cached and shared across all users.
    let globalResults = searchCache.get(normalizedQuery)
    if (!globalResults) {
      let result = await searchGlobal(supabase, query)

      // Nothing at all — not a thin result, an empty screen. A typo dies at
      // retrieval (`name ILIKE '%sbzi%'` matches no row), so ranking never gets
      // to be clever about it. This is the only place we are allowed to change
      // what the user typed, and emptiness is what makes it safe: our
      // vocabulary is built from our own catalogue and cannot know every
      // product Open Food Facts holds, so a query that already found rows must
      // keep its spelling. See lib/typo-correction.ts.
      if (result.foods.length === 0) {
        const corrected = correctFoodQuery(query)
        if (corrected) result = await searchGlobal(supabase, corrected)
      }

      globalResults = result.foods
      // Cached under what the user typed, so the next identical search skips
      // both round trips — including the correction.
      searchCache.set(
        normalizedQuery,
        globalResults,
        result.degraded ? DEGRADED_CACHE_TTL_MS : CACHE_TTL_MS
      )
    }

    // Append the user's own estimate/custom foods after the shared results.
    // Global rows win a name+brand collision (an accurate IFCT/OFF row beats a
    // rough estimate or a self-entered custom food), so this only surfaces
    // scans/chat foods and custom foods the shared DB lacks.
    //
    // The slice matters: searchGlobal already caps at MAX_SEARCH_RESULTS and
    // this dedupe caps again, so on any query that filled the page the user's
    // own rows were appended past the limit and sliced straight back off —
    // making the whole per-user read above dead work. Give them a few reserved
    // slots inside the same budget instead.
    const ownSlots = Math.min(myOwnFoods.length, RESERVED_OWN_FOOD_SLOTS)
    const finalResult = collapseDuplicateFoods(
      [
        ...globalResults.slice(0, MAX_SEARCH_RESULTS - ownSlots),
        ...myOwnFoods,
      ].filter(isPlausibleFood),
      SOURCE_RANK
    )
    return NextResponse.json(finalResult)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
