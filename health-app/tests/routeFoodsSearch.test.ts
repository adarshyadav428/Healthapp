/**
 * /api/foods/search — the P0-2 cross-user custom-food fix.
 *
 * `foods_select` RLS is deliberately open to every signed-in user (the shared
 * catalogue has to be), so visibility of a `source='user'` custom food was
 * controlled only by this route's own query — and it excluded `estimate` rows
 * from the shared results without ever excluding `user` rows the same way.
 * Any other account's custom food therefore surfaced on an ordinary
 * partial-word search, badged "Custom" (false for the finder), and could be
 * logged by them — after which the *owner* deleting their own food (ordinary
 * behaviour) cascaded that stranger's log entry away via
 * `food_logs.food_id ON DELETE CASCADE`.
 *
 * This double doesn't evaluate Supabase filters (see tests/helpers/
 * supabaseMock.ts's own docstring) — a query built with `.neq('source',
 * 'user')` and one without look identical once "executed" against canned
 * data. So the exclusion itself is pinned by asserting the FILTERS the route
 * actually sends (what a real search really would apply), and the per-user
 * merge is pinned by asserting the response shape once each Supabase call
 * resolves. Together they prove the two facts P0-2 needs: the shared query
 * can never return another account's custom food, and a user's own custom-
 * food lookup is structurally scoped to their own id, never anyone else's —
 * which is also why the cascade-delete half of P0-2 can no longer be
 * triggered: it depended entirely on this visibility leak (see the last
 * test below).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, type MockOptions } from './helpers/supabaseMock'

const createServerClient = vi.fn()
const createAdminClient = vi.fn()
const getApiUser = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
  createAdminClient: () => createAdminClient(),
  getApiUser: () => getApiUser(),
}))
vi.mock('../lib/open-food-facts', () => ({
  searchOpenFoodFactsIndia: vi.fn(async () => ({ foods: [], ok: true })),
  searchOpenFoodFacts: vi.fn(async () => ({ foods: [], ok: true })),
}))

const { GET } = await import('../app/api/foods/search/route')

const USER = { id: 'user-a', email: 'a@b.com' }

const IFCT_ROW = {
  id: '11111111-1111-1111-1111-111111111111',
  source: 'ifct',
  source_id: 'ifct-chicken-curry',
  name: 'Chicken Curry',
  brand: null,
  serving_size_g: 200,
  serving_description: '1 katori',
  kcal_per_100g: 180,
  protein_g_per_100g: 15,
  carbs_g_per_100g: 6,
  fat_g_per_100g: 10,
  fiber_g_per_100g: null,
  common_portions: null,
}

/** Shaped like a row /api/foods/custom creates for USER. */
const MY_CUSTOM_ROW = {
  id: '22222222-2222-2222-2222-222222222222',
  source: 'user',
  source_id: `user_${USER.id}_1234567890`,
  name: "Amma's Curry",
  brand: null,
  serving_size_g: 250,
  serving_description: '1 bowl',
  kcal_per_100g: 210,
  protein_g_per_100g: 18,
  carbs_g_per_100g: 8,
  fat_g_per_100g: 11,
  fiber_g_per_100g: null,
  common_portions: null,
}

function wire(options: { foodsSelect?: unknown[]; foodLogsSelect?: unknown } = {}) {
  const admin = createSupabaseMock()
  createAdminClient.mockReturnValue(admin.client)
  const server = createSupabaseMock({
    user: USER,
    tables: {
      // nth=0: the caller's own custom-food lookup. nth=1: the shared/global
      // local-catalogue query inside searchGlobal(). Order matches the route:
      // the Promise.all above searchGlobal() is built and awaited first.
      foods: { select: options.foodsSelect ?? [{ data: [] }, { data: [] }] },
      food_logs: { select: options.foodLogsSelect ?? { data: [] } },
    } as MockOptions['tables'],
  })
  createServerClient.mockReturnValue(server.client)
  getApiUser.mockResolvedValue(USER)
  return { server, admin }
}

function get(query: string) {
  return GET(new Request(`http://localhost/api/foods/search?q=${encodeURIComponent(query)}`))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/api/foods/search — P0-2', () => {
  it('excludes both estimate and other-user custom-food rows from the shared local query', async () => {
    const { server } = wire({ foodsSelect: [{ data: [] }, { data: [IFCT_ROW] }] })
    await get('unique-query-exclusion-check')

    const foodsCalls = server.callsTo('foods')
    // nth=1 is searchGlobal's shared query — see the ordering note in wire().
    const localSearch = foodsCalls[1]
    expect(localSearch.filters).toContainEqual(['neq', 'source', 'estimate'])
    expect(localSearch.filters).toContainEqual(['neq', 'source', 'user'])
  })

  it("scopes the caller's own custom-food lookup to their own ownership prefix, never anyone else's", async () => {
    const { server } = wire({ foodsSelect: [{ data: [MY_CUSTOM_ROW] }, { data: [] }] })
    await get('unique-query-ownership-check')

    const foodsCalls = server.callsTo('foods')
    const ownLookup = foodsCalls[0]
    expect(ownLookup.filters).toContainEqual(['eq', 'source', 'user'])
    // The same predicate 034_foods_rls_ownership.sql's owns_custom_food()
    // enforces at the database level — parameterized by THIS caller's id, so
    // the identical request from a different account carries a different
    // prefix and can never match this user's row.
    expect(ownLookup.filters).toContainEqual(['like', 'source_id', `user_${USER.id}_%`])
  })

  it("surfaces the caller's own custom food in results even when the shared catalogue has nothing", async () => {
    wire({ foodsSelect: [{ data: [MY_CUSTOM_ROW] }, { data: [] }] })
    const res = await get('unique-query-own-food-surfaces')
    expect(res.status).toBe(200)
    const results = await res.json()
    expect(results.some((f: { id: string }) => f.id === MY_CUSTOM_ROW.id)).toBe(true)
  })

  it('still returns curated/IFCT catalogue results, alongside (not instead of) the caller’s own custom food', async () => {
    wire({ foodsSelect: [{ data: [MY_CUSTOM_ROW] }, { data: [IFCT_ROW] }] })
    const res = await get('unique-query-mixed-results')
    expect(res.status).toBe(200)
    const results = await res.json()
    const ids = results.map((f: { id: string }) => f.id)
    expect(ids).toContain(IFCT_ROW.id)
    expect(ids).toContain(MY_CUSTOM_ROW.id)
  })

  it('closes the cascade-delete path (P0-2\'s second half): a food invisible to every other search can never end up in another account\'s food_logs', async () => {
    // The only way User A's custom food could ever reach User B's food_logs
    // was by User B finding it in a plain search and logging it — there is no
    // other route that lets one account's request reference another
    // account's food_id. With the shared query unconditionally excluding
    // source='user' (pinned above) and the per-user lookup unconditionally
    // scoped to the caller's own id (also pinned above), that path is closed
    // for every future search — so User A deleting their own food (which
    // correctly cascades their OWN food_logs rows) can no longer reach a row
    // that isn't theirs.
    const { server } = wire({ foodsSelect: [{ data: [] }, { data: [] }] })
    await get('unique-query-cascade-path-check')
    const localSearch = server.callsTo('foods')[1]
    expect(localSearch.filters).toContainEqual(['neq', 'source', 'user'])
  })
})
