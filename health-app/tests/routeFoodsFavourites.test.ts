/**
 * /api/foods/favourites — POST wires up an arbitrary client-supplied food_id
 * with no prior check at all. `foods_select` RLS is open to every signed-in
 * user, so nothing stopped a favourite from pointing at another user's
 * private `source='user'` custom food — and GET, which joins the full food
 * row back, would then leak that private food's name/macros to the favouriting
 * account on every future fetch. `isFoodReferenceableBy`
 * (lib/foodOwnership.ts) closes it. Audit 2026-09-04, P0-2 follow-up.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, type MockOptions } from './helpers/supabaseMock'

const createServerClient = vi.fn()
const getApiUser = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
  getApiUser: () => getApiUser(),
}))

const { POST } = await import('../app/api/foods/favourites/route')

const USER = { id: 'user-1', email: 'a@b.com' }

const CATALOGUE_FOOD_ID = '11111111-1111-1111-1111-111111111111'
const OTHER_USERS_CUSTOM_FOOD_ID = '99999999-9999-9999-9999-999999999999'
const MY_CUSTOM_FOOD_ID = '88888888-8888-8888-8888-888888888888'

function wire(foodRow: unknown, options: MockOptions = {}) {
  const mock = createSupabaseMock({
    user: USER,
    tables: {
      foods: { select: { data: foodRow } },
      food_favourites: { insert: { data: null, error: null } },
    },
    ...options,
  })
  createServerClient.mockReturnValue(mock.client)
  getApiUser.mockResolvedValue(USER)
  return mock
}

function post(foodId: string) {
  return POST(
    new Request('http://localhost/api/foods/favourites', { method: 'POST', body: JSON.stringify({ food_id: foodId }) })
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/foods/favourites — ownership (P0-2 follow-up)', () => {
  it('favourites an ordinary catalogue food normally', async () => {
    const mock = wire({ source: 'ifct', source_id: 'ifct-rice' })
    const res = await post(CATALOGUE_FOOD_ID)
    expect(res.status).toBe(200)
    expect(mock.callsTo('food_favourites').some((c) => c.operation === 'insert')).toBe(true)
  })

  it('favourites the caller\'s own custom food normally', async () => {
    const mock = wire({ source: 'user', source_id: `user_${USER.id}_1730000000000` })
    const res = await post(MY_CUSTOM_FOOD_ID)
    expect(res.status).toBe(200)
    expect(mock.callsTo('food_favourites').some((c) => c.operation === 'insert')).toBe(true)
  })

  it("404s rather than wiring up a favourite pointing at another user's private custom food", async () => {
    const mock = wire({ source: 'user', source_id: 'user_someone-else_1730000000000' })
    const res = await post(OTHER_USERS_CUSTOM_FOOD_ID)
    expect(res.status).toBe(404)
    expect(mock.callsTo('food_favourites').some((c) => c.operation === 'insert')).toBe(false)
  })

  it('404s the same way for a food that genuinely does not exist', async () => {
    const mock = wire(null)
    const res = await post(CATALOGUE_FOOD_ID)
    expect(res.status).toBe(404)
    expect(mock.callsTo('food_favourites').some((c) => c.operation === 'insert')).toBe(false)
  })
})
