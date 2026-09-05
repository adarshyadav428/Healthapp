/**
 * /api/logs/copy-yesterday — F4 (2026-09-05 adversarial-audit).
 *
 * Had no dedup at all, client or server (docs/refactor-safety-contract.md's
 * own documented accepted gap: "a double-tap duplicates yesterday's logs").
 * copied_from_id (migration 047) records which source row each copy came
 * from, unique per row, so a source row already copied is never copied
 * again — whether the retry is a rapid double-tap, a race between two
 * near-simultaneous requests, or a client retry after a dropped response.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, type MockOptions } from './helpers/supabaseMock'

const createServerClient = vi.fn()
const getApiUser = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
  getApiUser: (...args: unknown[]) => getApiUser(...args),
}))
vi.mock('../lib/posthog/server', () => ({ captureFoodLogged: vi.fn() }))

const { POST } = await import('../app/api/logs/copy-yesterday/route')

const USER = { id: 'user-1', email: 'a@b.com' }
const CONFLICT = { message: 'duplicate key value violates unique constraint', code: '23505' }

const YESTERDAY_LOGS = [
  { id: 'log-1', user_id: USER.id, food_id: 'f1', meal: 'lunch', grams: 150, servings: 1, kcal: 200, protein_g: 5, carbs_g: 30, fat_g: 2, logged_at: '2026-07-16T07:00:00.000Z' },
  { id: 'log-2', user_id: USER.id, food_id: 'f2', meal: 'dinner', grams: 100, servings: 1, kcal: 300, protein_g: 10, carbs_g: 20, fat_g: 8, logged_at: '2026-07-16T13:00:00.000Z' },
]

const ACTIVATION_TABLES = {
  profiles: { data: { created_at: '2026-01-01T00:00:00Z' } },
  streak_rescues: { data: [] },
}

function wire(options: { user?: MockOptions['user']; tables?: MockOptions['tables'] } = {}) {
  const user = options.user === undefined ? USER : options.user
  const mock = createSupabaseMock({ user, tables: options.tables })
  createServerClient.mockReturnValue(mock.client)
  getApiUser.mockResolvedValue(user)
  return mock
}

function request() {
  return new Request('http://localhost/api/logs/copy-yesterday', { method: 'POST' })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/logs/copy-yesterday', () => {
  it('401s an unauthenticated request', async () => {
    wire({ user: null })
    expect((await POST(request())).status).toBe(401)
  })

  it('404s when yesterday has nothing to copy', async () => {
    wire({ tables: { food_logs: { select: { data: [] } } } })
    expect((await POST(request())).status).toBe(404)
  })

  it('first request: copies every one of yesterday’s logs, tagging each with copied_from_id', async () => {
    const mock = wire({
      tables: {
        food_logs: {
          select: [
            { data: YESTERDAY_LOGS }, // yesterday's logs
            { count: 0 }, // today's count
            { data: [] }, // already-copied check: none yet
          ],
        },
        ...ACTIVATION_TABLES,
      },
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.copied).toBe(2)

    const insertCall = mock.callsTo('food_logs').find((c) => c.operation === 'insert')
    const rows = insertCall?.payload as { copied_from_id: string }[]
    expect(rows.map((r) => r.copied_from_id).sort()).toEqual(['log-1', 'log-2'])
  })

  it('identical second request (rapid double-tap): copies nothing, reports alreadyCopied, and never inserts', async () => {
    const mock = wire({
      tables: {
        food_logs: {
          select: [
            { data: YESTERDAY_LOGS }, // yesterday's logs (same as before)
            { count: 2 }, // today's count now includes the copies
            { data: [{ copied_from_id: 'log-1' }, { copied_from_id: 'log-2' }] }, // both already copied
          ],
        },
      },
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.copied).toBe(0)
    expect(json.alreadyCopied).toBe(true)
    expect(mock.callsTo('food_logs').some((c) => c.operation === 'insert')).toBe(false)
  })

  it('a genuine race — the pre-check misses a concurrent insert — is caught by the unique constraint and treated as already-copied, not an error', async () => {
    // The pre-check (nth=2 select) sees nothing copied yet — a concurrent
    // request wins the race and commits between our check and our insert —
    // so the insert itself is what surfaces the conflict.
    const mock = wire({
      tables: {
        food_logs: {
          select: [{ data: YESTERDAY_LOGS }, { count: 0 }, { data: [] }],
          insert: { data: null, error: CONFLICT },
        },
        ...ACTIVATION_TABLES,
      },
    })
    const res = await POST(request())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.copied).toBe(0)
    expect(json.alreadyCopied).toBe(true)
    expect(mock.callsTo('food_logs').filter((c) => c.operation === 'insert')).toHaveLength(1)
  })

  it('copying a genuinely new item added to yesterday since the last copy only copies the new one', async () => {
    const THIRD_LOG = { id: 'log-3', user_id: USER.id, food_id: 'f3', meal: 'snack', grams: 50, servings: 1, kcal: 100, protein_g: 2, carbs_g: 10, fat_g: 1, logged_at: '2026-07-16T18:00:00.000Z' }
    const mock = wire({
      tables: {
        // getLogActivationContext issues two more `food_logs` selects after
        // these three (a count-head, then a 60-day logged_at window) — the
        // trailing safe entries are for those, so a stray copied_from_id-only
        // row doesn't get cast as a {logged_at} row and blow up streak maths.
        food_logs: {
          select: [
            { data: [...YESTERDAY_LOGS, THIRD_LOG] }, // yesterday now has 3 items
            { count: 2 },
            { data: [{ copied_from_id: 'log-1' }, { copied_from_id: 'log-2' }] }, // only the first two already copied
            { count: 2 },
            { data: [] },
          ],
        },
        ...ACTIVATION_TABLES,
      },
    })
    const res = await POST(request())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.copied).toBe(1)
    const insertCall = mock.callsTo('food_logs').find((c) => c.operation === 'insert')
    const rows = insertCall?.payload as { copied_from_id: string }[]
    expect(rows.map((r) => r.copied_from_id)).toEqual(['log-3'])
  })
})
