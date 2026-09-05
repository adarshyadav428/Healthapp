/**
 * /api/logs/copy-meal — P2 (2026-09-05 QA follow-up).
 *
 * Had no dedup at all, client or server: real concurrent testing against the
 * qa2 fixture produced two duplicate food_log rows from two identical
 * requests. Fixed with the same copied_from_id mechanism as copy-yesterday
 * (migration 047), widened by migration 048 to a composite
 * (copied_from_id, target IST day) index — copy-meal, unlike copy-yesterday,
 * can legitimately paste the same source meal onto several different days,
 * so uniqueness must be scoped per target day, not global per source row.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, NO_SUB, type MockOptions } from './helpers/supabaseMock'

const createServerClient = vi.fn()
const getApiUser = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
  getApiUser: (...args: unknown[]) => getApiUser(...args),
}))
vi.mock('../lib/posthog/server', () => ({ captureFoodLogged: vi.fn() }))

const { POST } = await import('../app/api/logs/copy-meal/route')

const USER = { id: 'user-1', email: 'a@b.com' }
const CONFLICT = { message: 'duplicate key value violates unique constraint', code: '23505' }

const SOURCE_LOGS = [
  { id: 'log-1', user_id: USER.id, food_id: 'f1', meal: 'breakfast', grams: 150, servings: 1, kcal: 200, protein_g: 5, carbs_g: 30, fat_g: 2, logged_at: '2026-09-05T02:00:00.000Z' },
  { id: 'log-2', user_id: USER.id, food_id: 'f2', meal: 'breakfast', grams: 100, servings: 1, kcal: 300, protein_g: 10, carbs_g: 20, fat_g: 8, logged_at: '2026-09-05T02:30:00.000Z' },
]

const ACTIVATION_TABLES = {
  profiles: { data: { created_at: '2026-01-01T00:00:00Z' } },
  streak_rescues: { data: [] },
}

// Pasting onto a PAST day exercises resolveLoggedAtForRequest's backfill
// gate, which reads subscriptions + profiles — mirror that here.
const PAST_TARGET_TABLES = {
  subscriptions: NO_SUB,
}

function wire(options: { user?: MockOptions['user']; tables?: MockOptions['tables'] } = {}) {
  const user = options.user === undefined ? USER : options.user
  const mock = createSupabaseMock({ user, tables: options.tables })
  createServerClient.mockReturnValue(mock.client)
  getApiUser.mockResolvedValue(user)
  return mock
}

function request(body: unknown) {
  return new Request('http://localhost/api/logs/copy-meal', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/logs/copy-meal', () => {
  it('401s an unauthenticated request', async () => {
    wire({ user: null })
    const res = await POST(request({ from_date: '2026-09-05', meal: 'breakfast', date: '2026-09-04' }))
    expect(res.status).toBe(401)
  })

  it('400s when the source and target day are the same', async () => {
    wire({})
    const res = await POST(request({ from_date: '2026-09-05', meal: 'breakfast', date: '2026-09-05' }))
    expect(res.status).toBe(400)
  })

  it('404s when the source meal is empty', async () => {
    wire({ tables: { ...PAST_TARGET_TABLES, food_logs: { select: { data: [] } }, profiles: { data: { created_at: '2026-01-01T00:00:00Z' } } } })
    const res = await POST(request({ from_date: '2026-09-05', meal: 'breakfast', date: '2026-09-04' }))
    expect(res.status).toBe(404)
  })

  it('first request: copies every source row, tagging each with copied_from_id', async () => {
    const mock = wire({
      tables: {
        ...PAST_TARGET_TABLES,
        food_logs: {
          select: [
            { data: SOURCE_LOGS }, // source meal fetch
            { data: [] }, // filterUncopiedToDay: nothing copied yet
          ],
        },
        ...ACTIVATION_TABLES,
      },
    })
    const res = await POST(request({ from_date: '2026-09-05', meal: 'breakfast', date: '2026-09-04' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.copied).toBe(2)

    const insertCall = mock.callsTo('food_logs').find((c) => c.operation === 'insert')
    const rows = insertCall?.payload as { copied_from_id: string }[]
    expect(rows.map((r) => r.copied_from_id).sort()).toEqual(['log-1', 'log-2'])
  })

  it('identical second request (rapid double-tap): copies nothing, reports alreadyCopied, never inserts', async () => {
    const mock = wire({
      tables: {
        ...PAST_TARGET_TABLES,
        food_logs: {
          select: [
            { data: SOURCE_LOGS },
            // Both source rows already copied onto the SAME target day.
            { data: [
              { copied_from_id: 'log-1', logged_at: '2026-09-04T12:00:00+05:30' },
              { copied_from_id: 'log-2', logged_at: '2026-09-04T12:00:00+05:30' },
            ] },
          ],
        },
      },
    })
    const res = await POST(request({ from_date: '2026-09-05', meal: 'breakfast', date: '2026-09-04' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.copied).toBe(0)
    expect(json.alreadyCopied).toBe(true)
    expect(mock.callsTo('food_logs').some((c) => c.operation === 'insert')).toBe(false)
  })

  it('retry after a simulated timeout: second call sees the first request already landed, no duplicate', async () => {
    // Same shape as the double-tap case — a client-side "assume it failed and
    // retry" produces the identical request the server already fulfilled.
    const mock = wire({
      tables: {
        ...PAST_TARGET_TABLES,
        food_logs: {
          select: [
            { data: SOURCE_LOGS },
            { data: [
              { copied_from_id: 'log-1', logged_at: '2026-09-04T12:00:00+05:30' },
              { copied_from_id: 'log-2', logged_at: '2026-09-04T12:00:00+05:30' },
            ] },
          ],
        },
      },
    })
    const res = await POST(request({ from_date: '2026-09-05', meal: 'breakfast', date: '2026-09-04' }))
    const json = await res.json()
    expect(json).toEqual({ ok: true, copied: 0, alreadyCopied: true })
    expect(mock.callsTo('food_logs').some((c) => c.operation === 'insert')).toBe(false)
  })

  it('a genuine race — the pre-check misses a concurrent insert — is caught by the unique constraint and treated as already-copied, not an error', async () => {
    const mock = wire({
      tables: {
        ...PAST_TARGET_TABLES,
        food_logs: {
          select: [{ data: SOURCE_LOGS }, { data: [] }],
          insert: { data: null, error: CONFLICT },
        },
        ...ACTIVATION_TABLES,
      },
    })
    const res = await POST(request({ from_date: '2026-09-05', meal: 'breakfast', date: '2026-09-04' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.copied).toBe(0)
    expect(json.alreadyCopied).toBe(true)
    expect(mock.callsTo('food_logs').filter((c) => c.operation === 'insert')).toHaveLength(1)
  })

  it('a legitimate copy onto a DIFFERENT day succeeds even though this source meal was already copied elsewhere', async () => {
    // log-1/log-2 were already copied once, but onto 2026-09-03 — pasting the
    // same breakfast onto 2026-09-04 is a separate, allowed action.
    const mock = wire({
      tables: {
        ...PAST_TARGET_TABLES,
        food_logs: {
          select: [
            { data: SOURCE_LOGS },
            { data: [
              { copied_from_id: 'log-1', logged_at: '2026-09-03T12:00:00+05:30' },
              { copied_from_id: 'log-2', logged_at: '2026-09-03T12:00:00+05:30' },
            ] },
          ],
        },
        ...ACTIVATION_TABLES,
      },
    })
    const res = await POST(request({ from_date: '2026-09-05', meal: 'breakfast', date: '2026-09-04' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.copied).toBe(2)
  })

  it('partial retry: a new item added to the source meal since the last copy only copies the new one', async () => {
    const THIRD_LOG = { id: 'log-3', user_id: USER.id, food_id: 'f3', meal: 'breakfast', grams: 50, servings: 1, kcal: 100, protein_g: 2, carbs_g: 10, fat_g: 1, logged_at: '2026-09-05T03:00:00.000Z' }
    const mock = wire({
      tables: {
        ...PAST_TARGET_TABLES,
        food_logs: {
          select: [
            { data: [...SOURCE_LOGS, THIRD_LOG] }, // source meal now has 3 items
            // Only the first two were already copied onto THIS target day.
            { data: [
              { copied_from_id: 'log-1', logged_at: '2026-09-04T12:00:00+05:30' },
              { copied_from_id: 'log-2', logged_at: '2026-09-04T12:00:00+05:30' },
            ] },
          ],
        },
        ...ACTIVATION_TABLES,
      },
    })
    const res = await POST(request({ from_date: '2026-09-05', meal: 'breakfast', date: '2026-09-04' }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.copied).toBe(1)
    const insertCall = mock.callsTo('food_logs').find((c) => c.operation === 'insert')
    const rows = insertCall?.payload as { copied_from_id: string }[]
    expect(rows.map((r) => r.copied_from_id)).toEqual(['log-3'])
  })
})
