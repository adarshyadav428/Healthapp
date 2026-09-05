/**
 * /api/exercise/add — F3 (2026-09-05 adversarial-audit). Same fix as
 * /api/weight/add (tests/routeWeightAdd.test.ts): client_request_id, unique
 * per (user_id, client_request_id) via migration 046, routed through
 * insertIdempotent().
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, type MockOptions } from './helpers/supabaseMock'

const createServerClient = vi.fn()
const getApiUser = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
  getApiUser: (...args: unknown[]) => getApiUser(...args),
}))

const { POST } = await import('../app/api/exercise/add/route')

const USER = { id: 'user-1', email: 'a@b.com' }
const CONFLICT = { message: 'duplicate key value violates unique constraint', code: '23505' }
const VALID = { activity: 'Running', duration_min: 30, calories: 250 }

function wire(options: { user?: MockOptions['user']; tables?: MockOptions['tables'] } = {}) {
  const user = options.user === undefined ? USER : options.user
  const mock = createSupabaseMock({ user, tables: options.tables })
  createServerClient.mockReturnValue(mock.client)
  getApiUser.mockResolvedValue(user)
  return mock
}

function request(body: unknown) {
  return new Request('http://localhost/api/exercise/add', { method: 'POST', body: JSON.stringify(body) })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/exercise/add', () => {
  it('401s an unauthenticated request', async () => {
    wire({ user: null })
    expect((await POST(request(VALID))).status).toBe(401)
  })

  it('inserts a fresh row and threads client_request_id through', async () => {
    const mock = wire({
      tables: { exercise_logs: { insert: { data: { id: 'e1', ...VALID }, error: null } } },
    })
    const res = await POST(request({ ...VALID, client_request_id: '11111111-1111-1111-1111-111111111111' }))
    expect(res.status).toBe(200)
    const insertCall = mock.callsTo('exercise_logs').find((c) => c.operation === 'insert')
    expect((insertCall?.payload as { client_request_id: string }).client_request_id).toBe(
      '11111111-1111-1111-1111-111111111111'
    )
  })

  it('a duplicate client_request_id (rapid double-tap or a race) returns the existing row instead of a new one', async () => {
    const mock = wire({
      tables: {
        exercise_logs: {
          insert: { data: null, error: CONFLICT },
          select: { data: { id: 'e1', ...VALID }, error: null },
        },
      },
    })
    const res = await POST(request({ ...VALID, client_request_id: '11111111-1111-1111-1111-111111111111' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.row).toEqual({ id: 'e1', ...VALID })
    expect(mock.callsTo('exercise_logs').filter((c) => c.operation === 'insert')).toHaveLength(1)
  })

  it('two different client_request_id values (two legitimate workouts) both insert', async () => {
    const mock = wire({
      tables: { exercise_logs: { insert: { data: { id: 'e1', ...VALID }, error: null } } },
    })
    await POST(request({ ...VALID, client_request_id: '11111111-1111-1111-1111-111111111111' }))
    await POST(request({ ...VALID, activity: 'Cycling', client_request_id: '22222222-2222-2222-2222-222222222222' }))
    const inserts = mock.callsTo('exercise_logs').filter((c) => c.operation === 'insert')
    expect(inserts).toHaveLength(2)
    const keys = inserts.map((c) => (c.payload as { client_request_id: string }).client_request_id)
    expect(new Set(keys).size).toBe(2)
  })

  it('still works with no client_request_id at all (an older client) — dedup simply does not apply', async () => {
    wire({ tables: { exercise_logs: { insert: { data: { id: 'e1', ...VALID }, error: null } } } })
    expect((await POST(request(VALID))).status).toBe(200)
  })

  it('400s an invalid client_request_id (not a UUID)', async () => {
    wire()
    expect((await POST(request({ ...VALID, client_request_id: 'not-a-uuid' }))).status).toBe(400)
  })
})
