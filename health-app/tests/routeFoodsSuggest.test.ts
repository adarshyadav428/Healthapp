/**
 * /api/foods/suggest — the direct, id-agnostic leak this class had.
 *
 * Unlike the AI name-matching routes, this one needs no name collision at
 * all: `NON_MEASURED` only excluded `("curated","estimate")` from the
 * candidate pool, so every other user's private `source='user'` custom food
 * — id, name, macros and all — was eligible to be ranked and suggested to a
 * completely different account, purely because it happened to fit their
 * remaining calories/protein. `foods_select` RLS can't stop this (it's open
 * to every signed-in user for the shared catalogue); only the route's own
 * query can. Audit 2026-09-04, P0-2 follow-up.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, PRO_SUB, type MockOptions } from './helpers/supabaseMock'

const createServerClient = vi.fn()
const getAuthedUser = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
  getAuthedUser: () => getAuthedUser(),
}))
vi.mock('../lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))

const { GET } = await import('../app/api/foods/suggest/route')

const USER = { id: 'user-1', email: 'a@b.com' }

const RICE = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Rice',
  brand: null,
  source: 'ifct',
  source_id: 'ifct-rice',
  serving_size_g: 150,
  serving_description: '1 katori',
  kcal_per_100g: 130,
  protein_g_per_100g: 2.7,
  carbs_g_per_100g: 28,
  fat_g_per_100g: 0.3,
  fiber_g_per_100g: null,
  common_portions: null,
}
function wire(options: MockOptions = {}) {
  const mock = createSupabaseMock({
    user: USER,
    tables: {
      profiles: { data: { daily_calorie_target: 2000, protein_g_target: 120, created_at: '2026-01-01T00:00:00Z' } },
      food_logs: { data: [] },
      subscriptions: PRO_SUB,
      food_dismissals: { data: [] },
      foods: { select: { data: [] } },
    },
    ...options,
  })
  createServerClient.mockReturnValue(mock.client)
  getAuthedUser.mockResolvedValue(USER)
  return mock
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/foods/suggest — ownership (P0-2 follow-up)', () => {
  /**
   * The query-level exclusion is the ONLY line of defence here — `suggestMeals`
   * (lib/mealSuggest.ts) has no per-caller context and no source-based
   * exclusion of its own, only a rank tie-break (SOURCE_RANK), exactly the way
   * `estimate` rows were already handled by this route before this fix: a
   * `source='estimate'`/`source='user'` row that reaches the candidate pool
   * WILL be ranked and can be suggested. So pinning that the query itself
   * excludes `'user'` (this test) is what actually closes the leak — not a
   * downstream filter that doesn't exist.
   */
  it("excludes 'user' from the measured-tier pool query, alongside 'curated' and 'estimate'", async () => {
    const mock = wire()
    await GET()

    const poolQuery = mock.callsTo('foods').find((c) => c.operation === 'select')
    const notFilter = poolQuery?.filters.find((f) => f[0] === 'not')
    expect(notFilter).toBeTruthy()
    expect(notFilter?.[1]).toBe('source.in')
    expect(notFilter?.[2]).toContain('"user"')
  })

  it('still suggests an ordinary measured/curated catalogue food normally', async () => {
    const mock = wire({
      tables: {
        profiles: { data: { daily_calorie_target: 2000, protein_g_target: 120, created_at: '2026-01-01T00:00:00Z' } },
        food_logs: { data: [] },
        subscriptions: PRO_SUB,
        food_dismissals: { data: [] },
        foods: { select: { data: [RICE] } },
      },
    })
    void mock
    const res = await GET()
    const json = await res.json()
    const ids = (json.suggestions as { food: { id: string } }[]).map((s) => s.food.id)
    expect(ids).toContain(RICE.id)
  })
})
