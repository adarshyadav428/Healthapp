/**
 * /api/logs/add-bulk — multi-food logging (camera scan, chat log).
 *
 * Until this pass the route had no duplicate-submission protection at all —
 * only client-side useState guards in useCameraScan/useChatLog, which close
 * a same-tick double-tap but not a network retry, a client crash/retry, or
 * two genuinely simultaneous requests. Either can duplicate a whole plate.
 *
 * Fixed via insertIdempotentBatch (lib/requestIdempotency.ts) + migration
 * 050 — every row in a batch carries the SAME client-generated key plus its
 * ordinal position, unique per (user_id, batch_request_id, batch_seq). A
 * retry resends the identical items in the identical order, so it reproduces
 * the identical pairs and the whole batch collapses into the rows already
 * written, rather than 500ing or duplicating the meal.
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

const RICE = {
  id: '11111111-1111-1111-1111-111111111111',
  source: 'ifct', source_id: 'ifct-rice',
  kcal_per_100g: 130, protein_g_per_100g: 2.7, carbs_g_per_100g: 28, fat_g_per_100g: 0.3,
}
const DAL = {
  id: '22222222-2222-2222-2222-222222222222',
  source: 'ifct', source_id: 'ifct-dal',
  kcal_per_100g: 116, protein_g_per_100g: 9, carbs_g_per_100g: 20, fat_g_per_100g: 0.4,
}

const ITEMS = [
  { food_id: RICE.id, grams: 150, meal: 'lunch' as const },
  { food_id: DAL.id, grams: 200, meal: 'lunch' as const },
]

const EMPTY_SELECT = { data: null, count: null, error: null }

function wire(options: MockOptions = {}) {
  const mock = createSupabaseMock({
    user: USER,
    tables: {
      foods: { select: { data: [RICE, DAL] } },
      food_logs: { insert: { data: null, error: null } },
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

function post(body: Record<string, unknown>) {
  return POST(new Request('http://localhost/api/logs/add-bulk', { method: 'POST', body: JSON.stringify(body) }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/logs/add-bulk — normal batch', () => {
  it('inserts every item, tagged with a shared batch_request_id and each row\'s position', async () => {
    const mock = wire({
      tables: { foods: { select: { data: [RICE, DAL] } }, food_logs: { insert: { data: null, error: null } } },
    })
    const res = await post({ items: ITEMS, client_request_id: '11111111-aaaa-bbbb-cccc-111111111111' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.logged).toBe(2)

    const insertCall = mock.callsTo('food_logs').find((c) => c.operation === 'insert')
    const rows = insertCall?.payload as Array<{ batch_request_id: string; batch_seq: number }>
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.batch_request_id === '11111111-aaaa-bbbb-cccc-111111111111')).toBe(true)
    expect(rows.map((r) => r.batch_seq)).toEqual([0, 1])
  })

  it('an older client that sends no client_request_id logs normally, unprotected', async () => {
    const mock = wire({ tables: { foods: { select: { data: [RICE, DAL] } }, food_logs: { insert: { data: null, error: null } } } })
    const res = await post({ items: ITEMS })
    expect(res.status).toBe(200)
    const insertCall = mock.callsTo('food_logs').find((c) => c.operation === 'insert')
    const rows = insertCall?.payload as Array<{ batch_request_id?: string }>
    expect(rows.every((r) => r.batch_request_id === undefined)).toBe(true)
  })
})

describe('POST /api/logs/add-bulk — idempotency (release-hardening)', () => {
  const CONFLICT = { message: 'duplicate key value violates unique constraint', code: '23505' }
  const KEY = '22222222-aaaa-bbbb-cccc-222222222222'

  function postWithKey(clientRequestId: string) {
    return post({ items: ITEMS, client_request_id: clientRequestId })
  }

  it('a retry with the same client_request_id reports the rows that already exist instead of duplicating them', async () => {
    const mock = wire({
      tables: {
        foods: { select: { data: [RICE, DAL] } },
        food_logs: {
          insert: [
            { data: null, error: null },
            { data: null, error: CONFLICT },
          ],
          // getLogActivationContext reads food_logs twice per request (count,
          // then logs_before) before the insert; the 5th select is
          // insertIdempotentBatch's recovery count, fired only on the 2nd
          // request's conflict.
          select: [EMPTY_SELECT, EMPTY_SELECT, EMPTY_SELECT, EMPTY_SELECT, { data: null, count: 2, error: null }],
        },
      },
    })

    const first = await postWithKey(KEY)
    const second = await postWithKey(KEY)

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    const firstBody = await first.json()
    const secondBody = await second.json()
    expect(firstBody.logged).toBe(2)
    expect(secondBody.logged).toBe(2)

    // Both requests attempted an insert (that's the retry) — but the second
    // never becomes two independent persisted rows; it's recovered.
    expect(mock.callsTo('food_logs').filter((c) => c.operation === 'insert')).toHaveLength(2)
  })

  it('does not double-fire the milestone/analytics on a recovered replay', async () => {
    wire({
      tables: {
        foods: { select: { data: [RICE, DAL] } },
        food_logs: {
          insert: [
            { data: null, error: null },
            { data: null, error: CONFLICT },
          ],
          select: [EMPTY_SELECT, EMPTY_SELECT, EMPTY_SELECT, EMPTY_SELECT, { data: null, count: 2, error: null }],
        },
      },
    })
    await postWithKey(KEY)
    const second = await postWithKey(KEY)
    const body = await second.json()
    expect(body.milestone).toBeNull()
  })

  it('a genuinely separate batch (a fresh client_request_id) is never blocked', async () => {
    const mock = wire({ tables: { foods: { select: { data: [RICE, DAL] } }, food_logs: { insert: { data: null, error: null } } } })
    const res = await postWithKey('33333333-aaaa-bbbb-cccc-333333333333')
    expect(res.status).toBe(200)
    expect(mock.callsTo('food_logs').filter((c) => c.operation === 'insert')).toHaveLength(1)
  })

  it('a legitimate concurrent submission (different key, no relation to another batch) is unaffected by an unrelated conflict', async () => {
    // Sanity check: a 23505 with NO client_request_id in the request at all
    // (an older client) has nothing to recover with, and surfaces as a real
    // 500 rather than being silently swallowed as "already logged".
    wire({
      tables: {
        foods: { select: { data: [RICE, DAL] } },
        food_logs: { insert: { data: null, error: CONFLICT } },
      },
    })
    const res = await post({ items: ITEMS })
    expect(res.status).toBe(500)
  })
})
