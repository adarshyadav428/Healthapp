/**
 * /api/logs/quick-add — R8 (2026-09-13 remediation).
 *
 * Same duplicate-submission bug class as /api/logs/add (a raw calorie note
 * has no natural key either), fixed the same way: a client-generated
 * client_request_id, unique per (user_id, client_request_id) — migration 049.
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

const { POST } = await import('../app/api/logs/quick-add/route')

const USER = { id: 'user-1', email: 'a@b.com' }
const CONFLICT = { message: 'duplicate key value violates unique constraint', code: '23505' }
const EMPTY_SELECT = { data: null, error: null }
const KEY = '33333333-aaaa-bbbb-cccc-333333333333'

function wire(options: MockOptions = {}) {
  const mock = createSupabaseMock({
    user: USER,
    tables: {
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

function post(clientRequestId: string) {
  return POST(
    new Request('http://localhost/api/logs/quick-add', {
      method: 'POST',
      body: JSON.stringify({ kcal: 450, meal: 'snack', client_request_id: clientRequestId }),
    })
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/api/logs/quick-add — idempotency (R8)', () => {
  it('logs normally on the first submission', async () => {
    const mock = wire()
    const res = await post(KEY)
    expect(res.status).toBe(200)
    expect(mock.callsTo('food_logs').filter((c) => c.operation === 'insert')).toHaveLength(1)
  })

  it('a retry with the same client_request_id after a conflict is treated as the same submission, not a new row', async () => {
    const mock = wire({
      tables: {
        food_logs: {
          insert: [
            { data: { id: 'log-1' }, error: null },
            { data: null, error: CONFLICT },
          ],
          select: [EMPTY_SELECT, EMPTY_SELECT, EMPTY_SELECT, EMPTY_SELECT, { data: { id: 'log-1' }, error: null }],
        },
      },
    })
    const first = await post(KEY)
    const second = await post(KEY)
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    // Both requests attempted an insert (that's the race); the second's
    // conflict is recovered rather than surfaced as a duplicate row.
    expect(mock.callsTo('food_logs').filter((c) => c.operation === 'insert')).toHaveLength(2)
  })

  it('does not double-fire the milestone on a recovered replay', async () => {
    wire({
      tables: {
        food_logs: {
          insert: [
            { data: { id: 'log-1' }, error: null },
            { data: null, error: CONFLICT },
          ],
          select: [EMPTY_SELECT, EMPTY_SELECT, EMPTY_SELECT, EMPTY_SELECT, { data: { id: 'log-1' }, error: null }],
        },
      },
    })
    await post(KEY)
    const second = await post(KEY)
    const body = await second.json()
    expect(body.milestone).toBeNull()
  })

  it('a genuinely separate quick-add (a fresh key) is never blocked', async () => {
    const mock = wire()
    const res = await post('44444444-aaaa-bbbb-cccc-444444444444')
    expect(res.status).toBe(200)
    expect(mock.callsTo('food_logs').filter((c) => c.operation === 'insert')).toHaveLength(1)
  })
})
