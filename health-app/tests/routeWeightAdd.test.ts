/**
 * /api/weight/add — F3 (2026-09-05 adversarial-audit).
 *
 * WeightLogModal used to guard double-submit with `useState` alone
 * (`disabled={isSubmitting}`), which does not close a same-tick double-tap
 * or race, and the table had no constraint to catch a duplicate that got
 * through. These pin the server side of the fix: client_request_id, unique
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

const { POST } = await import('../app/api/weight/add/route')

const USER = { id: 'user-1', email: 'a@b.com' }
const CONFLICT = { message: 'duplicate key value violates unique constraint', code: '23505' }

function wire(options: { user?: MockOptions['user']; tables?: MockOptions['tables'] } = {}) {
  const user = options.user === undefined ? USER : options.user
  const mock = createSupabaseMock({ user, tables: options.tables })
  createServerClient.mockReturnValue(mock.client)
  getApiUser.mockResolvedValue(user)
  return mock
}

function request(body: unknown) {
  return new Request('http://localhost/api/weight/add', { method: 'POST', body: JSON.stringify(body) })
}

const VALID = { weight_kg: 70, measured_at: '2026-07-17T00:00:00.000Z' }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/weight/add', () => {
  it('401s an unauthenticated request', async () => {
    wire({ user: null })
    const res = await POST(request(VALID))
    expect(res.status).toBe(401)
  })

  it('inserts a fresh row and threads client_request_id through', async () => {
    const mock = wire({
      tables: { weight_logs: { insert: { data: { id: 'w1', ...VALID }, error: null } } },
    })
    const res = await POST(request({ ...VALID, client_request_id: '11111111-1111-1111-1111-111111111111' }))
    expect(res.status).toBe(200)
    const insertCall = mock.callsTo('weight_logs').find((c) => c.operation === 'insert')
    expect((insertCall?.payload as { client_request_id: string }).client_request_id).toBe(
      '11111111-1111-1111-1111-111111111111'
    )
  })

  it('a duplicate client_request_id (rapid double-tap or a race) returns the existing row instead of a new one', async () => {
    const mock = wire({
      tables: {
        weight_logs: {
          insert: { data: null, error: CONFLICT },
          select: { data: { id: 'w1', weight_kg: 70 }, error: null },
        },
        profiles: { data: null, error: null },
      },
    })
    const res = await POST(request({ ...VALID, client_request_id: '11111111-1111-1111-1111-111111111111' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.row).toEqual({ id: 'w1', weight_kg: 70 })
    // Only one insert was attempted — the conflict was resolved by reading
    // back the existing row, not by retrying the insert.
    expect(mock.callsTo('weight_logs').filter((c) => c.operation === 'insert')).toHaveLength(1)
  })

  it('two different client_request_id values (two legitimate weigh-ins) both insert', async () => {
    const mock = wire({
      tables: { weight_logs: { insert: { data: { id: 'w1', ...VALID }, error: null } } },
    })
    await POST(request({ ...VALID, client_request_id: '11111111-1111-1111-1111-111111111111' }))
    await POST(request({ ...VALID, weight_kg: 71, client_request_id: '22222222-2222-2222-2222-222222222222' }))
    const inserts = mock.callsTo('weight_logs').filter((c) => c.operation === 'insert')
    expect(inserts).toHaveLength(2)
    const keys = inserts.map((c) => (c.payload as { client_request_id: string }).client_request_id)
    expect(new Set(keys).size).toBe(2)
  })

  it('still works with no client_request_id at all (an older client) — dedup simply does not apply', async () => {
    wire({
      tables: { weight_logs: { insert: { data: { id: 'w1', ...VALID }, error: null } } },
    })
    const res = await POST(request(VALID))
    expect(res.status).toBe(200)
  })

  it('400s an invalid client_request_id (not a UUID)', async () => {
    wire()
    const res = await POST(request({ ...VALID, client_request_id: 'not-a-uuid' }))
    expect(res.status).toBe(400)
  })
})

/**
 * R6 (2026-09-13 remediation): the target recalc used to fire on insertion
 * order, not chronological order — backdating an old weigh-in ≥0.5 kg
 * different from the stored `current_weight_kg` could overwrite live
 * calorie/macro targets with stale historical data. Confirmed live: 14
 * backdated weigh-ins posted in chronological order shifted the target from
 * 1,589 to 1,578 kcal. Fixed by gating the recalc on whether this entry is
 * chronologically the latest weigh-in on record (an explicit newer-row
 * check), not merely the most recently inserted one.
 *
 * Established product rule (unchanged by this fix, confirmed correct):
 * `current_weight_kg`/the calorie target are meant to track the user's most
 * RECENT known weight — the bug was that "most recent" was read as
 * "most recently inserted" instead of "most recent by measured_at".
 */
describe('POST /api/weight/add — recalc only follows the chronologically latest entry (R6)', () => {
  const PROFILE = {
    current_weight_kg: 80,
    height_cm: 175,
    age: 30,
    sex: 'male',
    activity_level: 'moderate',
    goal: 'lose',
    pace_kg_per_week: 0.5,
  }

  it('recalculates targets when the new entry IS the latest weigh-in on record', async () => {
    const mock = wire({
      tables: {
        weight_logs: {
          insert: { data: { id: 'w1', weight_kg: 75, measured_at: '2026-09-13T00:00:00.000Z' }, error: null },
          // No row newer than this entry's measured_at — it IS the latest.
          select: { data: null, error: null },
        },
        profiles: { select: { data: PROFILE, error: null }, update: { data: null, error: null } },
      },
    })
    const res = await POST(request({ weight_kg: 75, measured_at: '2026-09-13T00:00:00.000Z' }))
    expect(res.status).toBe(200)
    expect(mock.callsTo('profiles').some((c) => c.operation === 'update')).toBe(true)
  })

  it('does NOT recalculate targets for a backdated entry when a newer weigh-in already exists', async () => {
    const mock = wire({
      tables: {
        weight_logs: {
          insert: { data: { id: 'w0', weight_kg: 90, measured_at: '2026-08-01T00:00:00.000Z' }, error: null },
          // A row with a later measured_at already exists — this insert is
          // backfilling history, not reporting today's weight.
          select: { data: { id: 'existing-newer-row' }, error: null },
        },
        profiles: { select: { data: PROFILE, error: null }, update: { data: null, error: null } },
      },
    })
    const res = await POST(request({ weight_kg: 90, measured_at: '2026-08-01T00:00:00.000Z' }))
    expect(res.status).toBe(200)
    expect(mock.callsTo('profiles').some((c) => c.operation === 'update')).toBe(false)
  })

  it('the newer-row check is scoped to the caller and compares by measured_at', async () => {
    const mock = wire({
      tables: {
        weight_logs: {
          insert: { data: { id: 'w0', weight_kg: 90, measured_at: '2026-08-01T00:00:00.000Z' }, error: null },
          select: { data: null, error: null },
        },
        profiles: { select: { data: PROFILE, error: null }, update: { data: null, error: null } },
      },
    })
    await POST(request({ weight_kg: 90, measured_at: '2026-08-01T00:00:00.000Z' }))
    const newerRowCheck = mock.callsTo('weight_logs').find(
      (c) => c.operation === 'select' && c.filters.some((f) => f[0] === 'gt' && f[1] === 'measured_at')
    )
    expect(newerRowCheck?.filters).toContainEqual(['eq', 'user_id', USER.id])
    expect(newerRowCheck?.filters).toContainEqual(['gt', 'measured_at', '2026-08-01T00:00:00.000Z'])
  })
})
