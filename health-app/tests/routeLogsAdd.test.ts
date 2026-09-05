/**
 * /api/logs/add — the single-item logging path.
 *
 * `foods_select` RLS is open to every signed-in user (the shared catalogue
 * has to be readable by everyone), so `.eq('id', food_id).maybeSingle()` will
 * happily return another user's private `source='user'` custom food if the
 * caller supplies its UUID — no error, no RLS denial, just a normal-looking
 * row. `isFoodReferenceableBy` (lib/foodOwnership.ts) is the only thing that
 * can catch it. Audit 2026-09-04, P0-2 follow-up.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, NO_SUB, type MockOptions } from './helpers/supabaseMock'

const createServerClient = vi.fn()
const getApiUser = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
  getApiUser: () => getApiUser(),
}))
vi.mock('../lib/posthog/server', () => ({ captureFoodLogged: vi.fn() }))

const { POST } = await import('../app/api/logs/add/route')

const USER = { id: 'user-1', email: 'a@b.com' }

const CATALOGUE_FOOD = {
  id: '11111111-1111-1111-1111-111111111111',
  source: 'ifct',
  source_id: 'ifct-rice',
  kcal_per_100g: 130,
  protein_g_per_100g: 2.7,
  carbs_g_per_100g: 28,
  fat_g_per_100g: 0.3,
}
const OTHER_USERS_CUSTOM_FOOD = {
  id: '99999999-9999-9999-9999-999999999999',
  source: 'user',
  source_id: 'user_someone-else_1730000000000',
  kcal_per_100g: 400,
  protein_g_per_100g: 30,
  carbs_g_per_100g: 10,
  fat_g_per_100g: 20,
}
const MY_CUSTOM_FOOD = {
  id: '88888888-8888-8888-8888-888888888888',
  source: 'user',
  source_id: `user_${USER.id}_1730000000000`,
  kcal_per_100g: 210,
  protein_g_per_100g: 18,
  carbs_g_per_100g: 8,
  fat_g_per_100g: 11,
}

function wire(options: MockOptions = {}) {
  const mock = createSupabaseMock({
    user: USER,
    tables: {
      foods: { select: { data: CATALOGUE_FOOD } },
      food_logs: { insert: { data: { id: 'log-1' }, error: null } },
      profiles: { data: { created_at: '2026-08-01T00:00:00Z' } },
      subscriptions: NO_SUB,
      streak_rescues: { data: [] },
    },
    ...options,
  })
  createServerClient.mockReturnValue(mock.client)
  getApiUser.mockResolvedValue(USER)
  return mock
}

function post(foodId: string) {
  return POST(
    new Request('http://localhost/api/logs/add', {
      method: 'POST',
      body: JSON.stringify({ food_id: foodId, grams: 100, servings: 1, meal: 'lunch' }),
    })
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/api/logs/add — ownership (P0-2 follow-up)', () => {
  it('logs an ordinary catalogue food normally', async () => {
    const mock = wire({ tables: { foods: { select: { data: CATALOGUE_FOOD } } } })
    const res = await post(CATALOGUE_FOOD.id)
    expect(res.status).toBe(200)
    expect(mock.callsTo('food_logs').some((c) => c.operation === 'insert')).toBe(true)
  })

  it('logs the caller\'s own custom food normally', async () => {
    const mock = wire({ tables: { foods: { select: { data: MY_CUSTOM_FOOD } } } })
    const res = await post(MY_CUSTOM_FOOD.id)
    expect(res.status).toBe(200)
    expect(mock.callsTo('food_logs').some((c) => c.operation === 'insert')).toBe(true)
  })

  it("404s (as if the food didn't exist) rather than logging another user's private custom food", async () => {
    const mock = wire({ tables: { foods: { select: { data: OTHER_USERS_CUSTOM_FOOD } } } })
    const res = await post(OTHER_USERS_CUSTOM_FOOD.id)
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Food not found')
    expect(mock.callsTo('food_logs').some((c) => c.operation === 'insert')).toBe(false)
  })
})
