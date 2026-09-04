/**
 * /api/cron/weekly-recap — the P1-1 fix.
 *
 * The weekly-recap half of this route already checks its four batched reads
 * (profiles/weight_logs/subscriptions/weekly_recaps) and throws on failure —
 * fixed 2026-09-03. `generateMonthlyWraps`, twelve lines below that fix in the
 * same file, destructured its own three batched reads (food_logs/weight_logs/
 * monthly_wraps) with no error check at all: a failed `monthly_wraps` read
 * ("who's already been wrapped this month") would silently turn every
 * already-wrapped user back into a candidate and push them a SECOND "Your
 * Month is ready" notification; a failed `food_logs` read would silently wrap
 * nobody while still reporting a clean-looking response.
 *
 * This route has no top-level try/catch (by design — see the existing throws
 * for the weekly reads), so a thrown error inside it rejects the handler's
 * promise rather than becoming a 500 Response when called directly, the same
 * way tests/pushSend.test.ts pins lib/push/budgetedSend's equivalent throws.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, type MockOptions } from './helpers/supabaseMock'

const createAdminClient = vi.fn()
const sendBudgetedPush = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createAdminClient: () => createAdminClient(),
}))
vi.mock('../lib/push/budgetedSend', () => ({
  sendBudgetedPush: (...args: unknown[]) => sendBudgetedPush(...args),
}))
// Force the monthly-wrap branch to run regardless of the real calendar date —
// everything else in the module (previousMonthStart, istDayStartInstant,
// monthLabel, MIN_DAYS_FOR_WRAP) stays real so the date arithmetic under test
// is the same arithmetic production runs.
vi.mock('../lib/monthlyWrapped', async () => {
  const actual = await vi.importActual<typeof import('../lib/monthlyWrapped')>('../lib/monthlyWrapped')
  return { ...actual, isMonthlyWrapWindow: () => true }
})

const { GET } = await import('../app/api/cron/weekly-recap/route')

const CRON_SECRET = 'test-cron-secret'
const DB_DOWN = { message: 'connection reset', code: '08006' }

const ACTIVE_LOG = { user_id: 'user-1', kcal: 500, logged_at: new Date().toISOString() }

function wire(tables: MockOptions['tables']) {
  const mock = createSupabaseMock({ tables })
  createAdminClient.mockReturnValue(mock.client)
  return mock
}

function request() {
  return new Request('http://localhost/api/cron/weekly-recap', {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = CRON_SECRET
  sendBudgetedPush.mockResolvedValue({ sent: 0 })
})

describe('GET /api/cron/weekly-recap — generateMonthlyWraps error handling (P1-1)', () => {
  it('fails loudly instead of silently re-wrapping everyone when the "already wrapped" read fails', async () => {
    wire({
      // nth=0: the weekly active-users query. nth=1: generateMonthlyWraps's own
      // food_logs read — never reached because monthly_wraps errors first in
      // the same Promise.all, so a single entry covers the weekly call.
      food_logs: { select: { data: [ACTIVE_LOG] } },
      profiles: { select: { data: [{ id: 'user-1', display_name: 'Test' }] } },
      weight_logs: { select: { data: [] } },
      subscriptions: { select: { data: [] } },
      weekly_recaps: { select: { data: [] }, upsert: { data: null, error: null } },
      monthly_wraps: { select: { data: null, error: DB_DOWN } },
    })

    await expect(GET(request())).rejects.toThrow(/monthly wrap monthly_wraps read failed/)
    // The weekly send loop had already run before the throw (it's a real side
    // effect, not undone by the later failure) — but no monthly push was ever
    // attempted, since the throw happens before any per-user work starts.
    expect(sendBudgetedPush).toHaveBeenCalledTimes(1)
    expect(sendBudgetedPush).toHaveBeenCalledWith('user-1', 'weekly-recap', expect.anything())
  })

  it('fails loudly instead of silently wrapping nobody when the food_logs read fails', async () => {
    wire({
      food_logs: { select: [{ data: [ACTIVE_LOG] }, { data: null, error: DB_DOWN }] },
      profiles: { select: { data: [{ id: 'user-1', display_name: 'Test' }] } },
      weight_logs: { select: { data: [] } },
      subscriptions: { select: { data: [] } },
      weekly_recaps: { select: { data: [] }, upsert: { data: null, error: null } },
      monthly_wraps: { select: { data: [] } },
    })

    await expect(GET(request())).rejects.toThrow(/monthly wrap food_logs read failed/)
  })

  it('still writes and pushes a monthly wrap normally when every read succeeds', async () => {
    // 5 distinct logged days in the wrapped month, clearing MIN_DAYS_FOR_WRAP.
    const monthLogs = Array.from({ length: 5 }, (_, i) => ({
      user_id: 'user-1',
      kcal: 500,
      protein_g: 20,
      logged_at: `2026-01-0${i + 1}T10:00:00Z`,
      food: { name: 'Rice' },
    }))
    const mock = wire({
      food_logs: { select: [{ data: [ACTIVE_LOG] }, { data: monthLogs }] },
      profiles: { select: { data: [{ id: 'user-1', display_name: 'Test' }] } },
      weight_logs: { select: [{ data: [] }, { data: [] }] },
      subscriptions: { select: { data: [] } },
      weekly_recaps: { select: { data: [] }, upsert: { data: null, error: null } },
      monthly_wraps: { select: { data: [] }, upsert: { data: null, error: null } },
    })

    const res = await GET(request())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.monthly.written).toBe(1)
    expect(json.monthly.candidates).toBe(1)

    const wrapUpsert = mock.callsTo('monthly_wraps').find((c) => c.operation === 'upsert')
    expect(wrapUpsert).toBeTruthy()
    expect(sendBudgetedPush).toHaveBeenCalledWith('user-1', 'monthly-wrapped', expect.anything())
  })
})
