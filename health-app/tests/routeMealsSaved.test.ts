/**
 * /api/meals/saved (POST) — creating a saved combo.
 *
 * A saved combo's items carry client-supplied food_ids that persist
 * indefinitely and are trusted verbatim by every future "log this combo" tap
 * (/api/meals/log). `foods_select` RLS is open to every signed-in user, so
 * nothing stopped an item from pointing at another user's private
 * `source='user'` custom food — the combo's owner would then see that food's
 * name/macros in their own saved-meals GET, and re-log it indefinitely.
 * `isFoodReferenceableBy` (lib/foodOwnership.ts) closes it at creation time.
 * Audit 2026-09-04, P0-2 follow-up.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, type MockOptions } from './helpers/supabaseMock'

const createServerClient = vi.fn()
const getApiUser = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
  getApiUser: () => getApiUser(),
}))
vi.mock('../lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))

const { POST } = await import('../app/api/meals/saved/route')

const USER = { id: 'user-1', email: 'a@b.com' }

const RICE = { id: '11111111-1111-1111-1111-111111111111', source: 'ifct', source_id: 'ifct-rice' }
const MY_CUSTOM = { id: '88888888-8888-8888-8888-888888888888', source: 'user', source_id: `user_${USER.id}_1730000000000` }
const OTHER_USERS_CUSTOM = { id: '99999999-9999-9999-9999-999999999999', source: 'user', source_id: 'user_someone-else_1730000000000' }

function wire(foodsRow: unknown[], options: MockOptions = {}) {
  const mock = createSupabaseMock({
    user: USER,
    tables: {
      foods: { select: { data: foodsRow } },
      saved_meals: { insert: { data: { id: 'meal-1' }, error: null } },
      saved_meal_items: { insert: { data: null, error: null } },
    },
    ...options,
  })
  createServerClient.mockReturnValue(mock.client)
  getApiUser.mockResolvedValue(USER)
  return mock
}

function post(items: { food_id: string; grams: number; servings: number }[]) {
  return POST(
    new Request('http://localhost/api/meals/saved', {
      method: 'POST',
      body: JSON.stringify({ name: 'My Combo', items }),
    })
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/meals/saved — ownership (P0-2 follow-up)', () => {
  it('saves a combo of catalogue foods and the caller\'s own custom food', async () => {
    const mock = wire([RICE, MY_CUSTOM])
    const res = await post([
      { food_id: RICE.id, grams: 150, servings: 1 },
      { food_id: MY_CUSTOM.id, grams: 200, servings: 1 },
    ])
    expect(res.status).toBe(200)
    expect(mock.callsTo('saved_meal_items').some((c) => c.operation === 'insert')).toBe(true)
  })

  it("refuses to save a combo item that points at another user's private custom food", async () => {
    const mock = wire([RICE, OTHER_USERS_CUSTOM])
    const res = await post([
      { food_id: RICE.id, grams: 150, servings: 1 },
      { food_id: OTHER_USERS_CUSTOM.id, grams: 100, servings: 1 },
    ])
    expect(res.status).toBe(404)
    // Nothing was persisted — not the meal, not the items — a partially
    // poisoned combo is worse than no combo.
    expect(mock.callsTo('saved_meals').some((c) => c.operation === 'insert')).toBe(false)
    expect(mock.callsTo('saved_meal_items').some((c) => c.operation === 'insert')).toBe(false)
  })
})
