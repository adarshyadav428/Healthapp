/**
 * /api/logs/add-bulk — the shared multi-item write for the chat flow and, since
 * the camera scan started logging a whole plate at once, the photo path too.
 *
 * The route has no unit column and no unit branch: it stores each item's
 * `grams` verbatim and scales kcal/macros with `amount / 100 × per-100`. That
 * is only correct because every food row is already in a per-100-of-its-own-unit
 * basis — /api/camera/analyze normalises a "pcs" food to a per-100-PIECES rate
 * before it ever reaches here. This file pins that a pcs item and a gram item in
 * one payload both come out right, so a future "pcs fix" that adds a branch has
 * something to fail against.
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

const { POST } = await import('../app/api/logs/add-bulk/route')

const USER = { id: 'user-1', email: 'a@b.com' }

// A weighed food: kcal_per_100g means "per 100 g".
const RICE = {
  id: '11111111-1111-1111-1111-111111111111',
  kcal_per_100g: 130,
  protein_g_per_100g: 2.7,
  carbs_g_per_100g: 28,
  fat_g_per_100g: 0.3,
}
// A counted food, as /api/camera/analyze persists it: kcal_per_100g means
// "per 100 PIECES", and the client sends `grams` = a piece count.
const WINGS = {
  id: '22222222-2222-2222-2222-222222222222',
  kcal_per_100g: 2000,
  protein_g_per_100g: 180,
  carbs_g_per_100g: 40,
  fat_g_per_100g: 130,
}

function wire(options: MockOptions = {}) {
  const mock = createSupabaseMock({
    user: USER,
    tables: {
      foods: { data: [RICE, WINGS] },
      // select #0 = the activation head-count, select #1 = the 60-day history
      food_logs: { select: [{ count: 0, data: null }, { data: [] }], insert: { data: null, error: null } },
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

function post(body: unknown) {
  return POST(new Request('http://localhost/api/logs/add-bulk', { method: 'POST', body: JSON.stringify(body) }))
}

const insertRows = (mock: ReturnType<typeof wire>) =>
  mock.callsTo('food_logs').find((c) => c.operation === 'insert')?.payload as Array<Record<string, number | string>>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/api/logs/add-bulk unit handling', () => {
  it('scales a gram item and a pcs item in the same payload against their own rows', async () => {
    const mock = wire()
    const res = await post({
      items: [
        { food_id: RICE.id, grams: 150, meal: 'lunch' },
        { food_id: WINGS.id, grams: 6, meal: 'lunch' },
      ],
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, logged: 2 })

    const rows = insertRows(mock)
    const rice = rows.find((r) => r.food_id === RICE.id)!
    const wings = rows.find((r) => r.food_id === WINGS.id)!

    // 130 kcal/100g × 150 g
    expect(rice.kcal).toBe(195)
    expect(rice.grams).toBe(150)
    // 2000 kcal/100 pieces × 6 pieces — the piece count rides in `grams`
    expect(wings.kcal).toBe(120)
    expect(wings.protein_g).toBe(10.8)
    expect(wings.grams).toBe(6)
  })

  it('stamps logged_at on every row rather than leaning on the column default', async () => {
    const mock = wire()
    await post({ items: [{ food_id: WINGS.id, grams: 3, meal: 'snack' }] })
    for (const row of insertRows(mock)) {
      expect(row.logged_at).toBeTruthy()
      expect(row.user_id).toBe(USER.id)
      expect(row.servings).toBe(1)
    }
  })
})
