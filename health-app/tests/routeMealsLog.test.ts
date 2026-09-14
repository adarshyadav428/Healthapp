/**
 * /api/meals/log (POST) — logging a saved combo.
 *
 * The combo itself is ownership-checked (`saved_meals.eq('user_id', user.id)`),
 * but that says nothing about the food_ids its *items* reference — until the
 * 2026-09-04 P0-2 follow-up, /api/meals/saved let a combo be SAVED with an
 * item pointing at another user's private `source='user'` custom food. This
 * route is the second line of defence: even a combo poisoned before that fix
 * existed must not be re-loggable, since `foods_select` RLS will happily
 * resolve the join regardless of who owns the food. `isFoodReferenceableBy`
 * (lib/foodOwnership.ts) filters such items out rather than logging them.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, type MockOptions } from './helpers/supabaseMock'

const createServerClient = vi.fn()
const getApiUser = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
  getApiUser: () => getApiUser(),
}))
vi.mock('../lib/posthog/server', () => ({ captureFoodLogged: vi.fn(), captureServerEvent: vi.fn() }))

const { POST } = await import('../app/api/meals/log/route')

const USER = { id: 'user-1', email: 'a@b.com' }

const RICE_ITEM = {
  food_id: '11111111-1111-1111-1111-111111111111',
  grams: 150,
  servings: 1,
  food: { source: 'ifct', source_id: 'ifct-rice', kcal_per_100g: 130, protein_g_per_100g: 2.7, carbs_g_per_100g: 28, fat_g_per_100g: 0.3 },
}
const POISONED_ITEM = {
  food_id: '99999999-9999-9999-9999-999999999999',
  grams: 100,
  servings: 1,
  food: { source: 'user', source_id: 'user_someone-else_1730000000000', kcal_per_100g: 400, protein_g_per_100g: 30, carbs_g_per_100g: 10, fat_g_per_100g: 20 },
}

function wire(items: unknown[], options: MockOptions = {}) {
  const mock = createSupabaseMock({
    user: USER,
    tables: {
      saved_meals: { select: { data: { id: '11111111-2222-3333-4444-555555555555', saved_meal_items: items } } },
      food_logs: { select: [{ count: 0, data: null }, { data: [] }], insert: { data: null, error: null } },
      profiles: { data: { created_at: '2026-08-01T00:00:00Z' } },
      subscriptions: { data: null },
      streak_rescues: { data: [] },
    },
    ...options,
  })
  createServerClient.mockReturnValue(mock.client)
  getApiUser.mockResolvedValue(USER)
  return mock
}

function post(extra: Record<string, unknown> = {}) {
  return POST(
    new Request('http://localhost/api/meals/log', {
      method: 'POST',
      body: JSON.stringify({ meal_id: '11111111-2222-3333-4444-555555555555', meal_type: 'lunch', ...extra }),
    })
  )
}

const insertRows = (mock: ReturnType<typeof wire>) =>
  mock.callsTo('food_logs').find((c) => c.operation === 'insert')?.payload as Array<Record<string, unknown>>

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/meals/log — ownership (P0-2 follow-up)', () => {
  it('logs an ordinary combo normally', async () => {
    const mock = wire([RICE_ITEM])
    const res = await post()
    expect(res.status).toBe(200)
    expect(insertRows(mock)).toHaveLength(1)
  })

  it("drops a poisoned item (another user's private custom food) and logs only the legitimate items", async () => {
    const mock = wire([RICE_ITEM, POISONED_ITEM])
    const res = await post()
    expect(res.status).toBe(200)
    const rows = insertRows(mock)
    expect(rows).toHaveLength(1)
    expect(rows[0].food_id).toBe(RICE_ITEM.food_id)
  })

  it('400s rather than logging anything when every item in the combo is poisoned', async () => {
    const mock = wire([POISONED_ITEM])
    const res = await post()
    expect(res.status).toBe(400)
    expect(mock.callsTo('food_logs').some((c) => c.operation === 'insert')).toBe(false)
  })
})

/**
 * R4 (2026-09-13 remediation): a saved_meal_items row can no longer carry an
 * absurd grams/servings pair (see routeMealsSaved.test.ts) — this pins the
 * consequence downstream, at the point that used to write 2,969,999,997 kcal
 * to food_logs. Even at the new valid maximum (10,000 g × 99 servings), the
 * resulting total stays a finite, bounded number rather than billions.
 */
describe('POST /api/meals/log — aggregate totals stay bounded (R4)', () => {
  const MAX_ITEM = {
    food_id: '22222222-2222-2222-2222-222222222222',
    grams: 10000,
    servings: 99,
    food: { source: 'ifct', source_id: 'ifct-oil', kcal_per_100g: 900, protein_g_per_100g: 0, carbs_g_per_100g: 0, fat_g_per_100g: 100 },
  }

  it('scales a combo at the new maximum to a large but finite, bounded kcal figure', async () => {
    const mock = wire([MAX_ITEM])
    const res = await post()
    expect(res.status).toBe(200)
    const rows = insertRows(mock)
    expect(rows).toHaveLength(1)
    // 900 kcal/100g × (10000g/100) × 99 servings = 8,910,000 — nonsensical
    // for a single food, but a fixed, bounded ceiling rather than the
    // unbounded billions the exploit reached (2,969,999,997).
    expect(rows[0].kcal).toBe(8_910_000)
    expect(Number.isFinite(rows[0].kcal as number)).toBe(true)
    expect(rows[0].kcal as number).toBeLessThan(2_969_999_997)
  })
})

/**
 * 2026-09-14 release-hardening pass: this route had no duplicate-submission
 * protection at all — a double-tap, a network retry, or two genuinely
 * simultaneous "Log this combo" taps could each file the whole meal twice.
 * Fixed via insertIdempotentBatch (lib/requestIdempotency.ts) + migration
 * 050 — see tests/routeLogsAddBulk.test.ts for the sibling coverage on
 * /api/logs/add-bulk, and requestIdempotency.test.ts for the function itself.
 */
describe('POST /api/meals/log — idempotency (release-hardening)', () => {
  const CONFLICT = { message: 'duplicate key value violates unique constraint', code: '23505' }
  const EMPTY_SELECT = { data: null, count: null, error: null }
  const KEY = '44444444-aaaa-bbbb-cccc-444444444444'

  it('a retry with the same client_request_id reports the item that already exists instead of duplicating it', async () => {
    const mock = wire([RICE_ITEM], {
      tables: {
        saved_meals: { select: { data: { id: '11111111-2222-3333-4444-555555555555', saved_meal_items: [RICE_ITEM] } } },
        food_logs: {
          insert: [
            { data: null, error: null },
            { data: null, error: CONFLICT },
          ],
          select: [EMPTY_SELECT, EMPTY_SELECT, EMPTY_SELECT, EMPTY_SELECT, { data: null, count: 1, error: null }],
        },
      },
    })

    const first = await post({ client_request_id: KEY })
    const second = await post({ client_request_id: KEY })

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect((await first.json()).logged).toBe(1)
    expect((await second.json()).logged).toBe(1)
    expect(mock.callsTo('food_logs').filter((c) => c.operation === 'insert')).toHaveLength(2)
  })

  it('a later intentional logging of the same saved meal, with a fresh client_request_id, is never blocked', async () => {
    const mock = wire([RICE_ITEM], {
      tables: {
        saved_meals: { select: { data: { id: '11111111-2222-3333-4444-555555555555', saved_meal_items: [RICE_ITEM] } } },
        food_logs: { insert: { data: null, error: null } },
      },
    })
    const res = await post({ client_request_id: '55555555-aaaa-bbbb-cccc-555555555555' })
    expect(res.status).toBe(200)
    expect(mock.callsTo('food_logs').filter((c) => c.operation === 'insert')).toHaveLength(1)
  })

  it('an older client sending no client_request_id still logs normally, unprotected', async () => {
    const mock = wire([RICE_ITEM])
    const res = await post()
    expect(res.status).toBe(200)
    const rows = insertRows(mock)
    expect(rows.every((r) => r.batch_request_id === undefined)).toBe(true)
  })
})
