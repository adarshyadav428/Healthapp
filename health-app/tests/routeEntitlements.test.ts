/**
 * Entitlement gates, asserted at the route boundary.
 *
 * Every one of these gates is a public claim or a paid limit, and none of them
 * had a test. The audit's §5 put route handlers at the top of the coverage gap
 * for a reason: the UI is explicitly *not* the boundary (CLAUDE.md says so of
 * the AI gates), so the only thing that matters is the status code a crafted
 * request gets. A test that drives the UI proves nothing about a curl.
 *
 * Two of these are regression pins for shipped bugs:
 *   - the /api/logs 7-day clamp, which the 2026-07-16 audit found was enforced
 *     only by the UI while the API returned unlimited history to any caller;
 *   - /api/export, which returned a silent 90-day slice — more than the 7 days
 *     the free tier advertises and less than the complete export its own CSV
 *     header claimed.
 *
 * Each gate is also tested with its subscription read FAILING. Until the
 * 2026-09-05 adversarial-audit F2 fix, a discarded error that left `sub`
 * undefined read as "not Pro" — which disabled the AI limit for weeks in one
 * direction, and in the other silently punished a real Pro user with a free
 * user's clamp/denial every time the read blipped. Neither extreme is
 * correct: `getIsPro` (lib/subscription.ts) now throws `SubscriptionReadError`
 * on a failed read, and every gate below turns that into an explicit 500 —
 * never a quiet "Free", never a quiet "Pro".
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createSupabaseMock,
  NO_SUB,
  PRO_SUB,
  type MockOptions,
  type SupabaseMock,
} from './helpers/supabaseMock'
import { istDaysAgoStart } from '../lib/dateUtils'

const createServerClient = vi.fn()
const createAdminClient = vi.fn()
const getApiUser = vi.fn()
const getAuthedUser = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
  createAdminClient: () => createAdminClient(),
  getApiUser: (...args: unknown[]) => getApiUser(...args),
  getAuthedUser: (...args: unknown[]) => getAuthedUser(...args),
}))

vi.mock('../lib/posthog/server', () => ({
  captureServerEvent: vi.fn(),
}))

const { GET: getLogs } = await import('../app/api/logs/route')
const { GET: getExerciseLogs } = await import('../app/api/exercise/logs/route')
const { GET: getWeightLogs } = await import('../app/api/weight/logs/route')
const { POST: postCustomFood } = await import('../app/api/foods/custom/route')
const { GET: getExport } = await import('../app/api/export/route')
const { POST: postRescue } = await import('../app/api/streak/rescue/route')

const USER = { id: 'user-1', email: 'a@b.com' }
const DB_DOWN = { message: 'connection reset', code: '08006' }

/** Wire the mocked module surface to a fresh double and return it. */
function useSupabase(options: MockOptions = {}): SupabaseMock {
  const mock = createSupabaseMock({ user: USER, ...options })
  createServerClient.mockReturnValue(mock.client)
  getApiUser.mockResolvedValue(options.user === undefined ? USER : options.user)
  getAuthedUser.mockResolvedValue(options.user === undefined ? USER : options.user)
  return mock
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/logs — the free tier’s 7-day history clamp', () => {
  /** The lower bound the route applied to logged_at, if any. */
  function appliedStart(mock: SupabaseMock): unknown {
    const call = mock.callsTo('food_logs').at(-1)
    return call?.filters.find(([op, col]) => op === 'gte' && col === 'logged_at')?.[2]
  }

  it('401s an unauthenticated request', async () => {
    useSupabase({ user: null })
    const res = await getLogs(new Request('http://localhost/api/logs'))
    expect(res.status).toBe(401)
  })

  it('clamps a free user with no start param to the last 7 days', async () => {
    const mock = useSupabase({ tables: { subscriptions: NO_SUB, food_logs: { data: [] } } })
    await getLogs(new Request('http://localhost/api/logs'))
    expect(appliedStart(mock)).toBe(istDaysAgoStart(7))
  })

  /** The attack the previous audit found working: ask for everything. */
  it('clamps a free user who crafts a start date years in the past', async () => {
    const mock = useSupabase({ tables: { subscriptions: NO_SUB, food_logs: { data: [] } } })
    await getLogs(new Request('http://localhost/api/logs?start=2020-01-01T00:00:00.000Z'))
    expect(appliedStart(mock)).toBe(istDaysAgoStart(7))
  })

  it('does not widen a free user’s narrower request', async () => {
    const mock = useSupabase({ tables: { subscriptions: NO_SUB, food_logs: { data: [] } } })
    const today = new Date().toISOString()
    await getLogs(new Request(`http://localhost/api/logs?start=${today}`))
    expect(appliedStart(mock)).toBe(today)
  })

  it('honours a Pro user’s full-history request', async () => {
    const mock = useSupabase({ tables: { subscriptions: PRO_SUB, food_logs: { data: [] } } })
    await getLogs(new Request('http://localhost/api/logs?start=2020-01-01T00:00:00.000Z'))
    expect(appliedStart(mock)).toBe('2020-01-01T00:00:00.000Z')
  })

  it('applies no lower bound at all for a Pro user who asks for none', async () => {
    const mock = useSupabase({ tables: { subscriptions: PRO_SUB, food_logs: { data: [] } } })
    await getLogs(new Request('http://localhost/api/logs'))
    expect(appliedStart(mock)).toBeUndefined()
  })

  it('500s when the subscription read fails, rather than silently clamping to Free (F2)', async () => {
    // Clamping here (the pre-fix behaviour) punished a real Pro user with the
    // free-tier window every time this read blipped — indistinguishable from
    // "genuinely free" to the caller. An explicit 500 is the only response
    // that neither grants unverified Pro nor wrongly denies a paying one.
    useSupabase({
      tables: { subscriptions: { data: null, error: DB_DOWN }, food_logs: { data: [] } },
    })
    const res = await getLogs(new Request('http://localhost/api/logs?start=2020-01-01T00:00:00.000Z'))
    expect(res.status).toBe(500)
  })

  /**
   * P1-1 (audit 2026-09-03). The clamp was a LEXICOGRAPHIC string compare
   * against an ISO cutoff, and nothing validated that `start` was ISO. Postgres
   * accepts these as timestamp literals, and every one of them sorts ABOVE
   * '2026-…' ('e', 't', 'n', 'y' all beat '2'), so each sailed past the clamp
   * and PostgREST forwarded it verbatim — `epoch` reading as 1970-01-01, i.e.
   * a free account's entire history through the app's own API.
   */
  it.each(['epoch', 'today', 'now', 'yesterday', 'infinity', 'allballs'])(
    'does not let the non-ISO literal %s defeat the clamp',
    async (literal) => {
      const mock = useSupabase({ tables: { subscriptions: NO_SUB, food_logs: { data: [] } } })
      const res = await getLogs(new Request(`http://localhost/api/logs?start=${literal}`))
      // Either rejected outright or clamped — never forwarded to Postgres.
      expect(appliedStart(mock) ?? istDaysAgoStart(7)).not.toBe(literal)
      if (res.status === 200) expect(appliedStart(mock)).toBe(istDaysAgoStart(7))
      else expect(res.status).toBe(400)
    }
  )

  it('rejects an unparseable start even for a Pro user', async () => {
    const mock = useSupabase({ tables: { subscriptions: PRO_SUB, food_logs: { data: [] } } })
    const res = await getLogs(new Request('http://localhost/api/logs?start=epoch'))
    expect(res.status).toBe(400)
    expect(appliedStart(mock)).toBeUndefined()
  })

  it('scopes the read to the calling user', async () => {
    const mock = useSupabase({ tables: { subscriptions: NO_SUB, food_logs: { data: [] } } })
    await getLogs(new Request('http://localhost/api/logs'))
    expect(mock.callsTo('food_logs').at(-1)?.filters).toContainEqual(['eq', 'user_id', USER.id])
  })

  it('500s rather than returning a partial list when the query fails', async () => {
    useSupabase({
      tables: { subscriptions: NO_SUB, food_logs: { data: null, error: DB_DOWN } },
    })
    const res = await getLogs(new Request('http://localhost/api/logs'))
    expect(res.status).toBe(500)
  })
})

describe('GET /api/exercise/logs — the same free-tier history clamp as /api/logs', () => {
  it('401s an unauthenticated request', async () => {
    useSupabase({ user: null })
    const res = await getExerciseLogs(new Request('http://localhost/api/exercise/logs'))
    expect(res.status).toBe(401)
  })

  it('clamps a free user to the last 7 days', async () => {
    const mock = useSupabase({ tables: { subscriptions: NO_SUB, exercise_logs: { data: [] } } })
    await getExerciseLogs(new Request('http://localhost/api/exercise/logs'))
    const call = mock.callsTo('exercise_logs').at(-1)
    expect(call?.filters.find(([op, col]) => op === 'gte' && col === 'logged_at')?.[2]).toBe(
      istDaysAgoStart(7)
    )
  })

  it('honours a Pro user’s full-history request', async () => {
    const mock = useSupabase({ tables: { subscriptions: PRO_SUB, exercise_logs: { data: [] } } })
    await getExerciseLogs(new Request('http://localhost/api/exercise/logs?start=2020-01-01T00:00:00.000Z'))
    const call = mock.callsTo('exercise_logs').at(-1)
    expect(call?.filters.find(([op, col]) => op === 'gte' && col === 'logged_at')?.[2]).toBe(
      '2020-01-01T00:00:00.000Z'
    )
  })

  it('500s when the subscription read fails, rather than silently clamping to Free (F2)', async () => {
    useSupabase({
      tables: { subscriptions: { data: null, error: DB_DOWN }, exercise_logs: { data: [] } },
    })
    const res = await getExerciseLogs(new Request('http://localhost/api/exercise/logs'))
    expect(res.status).toBe(500)
  })
})

describe('GET /api/weight/logs — Pro-uncapped weight history', () => {
  it('401s an unauthenticated request', async () => {
    useSupabase({ user: null })
    expect((await getWeightLogs()).status).toBe(401)
  })

  it('caps a free user’s rows', async () => {
    const mock = useSupabase({ tables: { subscriptions: NO_SUB, weight_logs: { data: [] } } })
    await getWeightLogs()
    expect(mock.callsTo('weight_logs').at(-1)?.operation).toBe('select')
  })

  it('serves a Pro user uncapped', async () => {
    useSupabase({ tables: { subscriptions: PRO_SUB, weight_logs: { data: [] } } })
    expect((await getWeightLogs()).status).toBe(200)
  })

  it('500s when the subscription read fails, rather than silently capping a real Pro user’s history (F2)', async () => {
    useSupabase({
      tables: { subscriptions: { data: null, error: DB_DOWN }, weight_logs: { data: [] } },
    })
    expect((await getWeightLogs()).status).toBe(500)
  })
})

describe('POST /api/foods/custom — Pro-only custom foods', () => {
  const VALID = {
    name: 'Amma’s Sambar',
    serving_size_g: 200,
    serving_description: '1 katori',
    kcal_per_100g: 60,
    protein_g_per_100g: 3,
    carbs_g_per_100g: 8,
    fat_g_per_100g: 2,
  }

  function request(body: unknown) {
    return new Request('http://localhost/api/foods/custom', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  }

  it('401s an unauthenticated request', async () => {
    useSupabase({ user: null })
    const res = await postCustomFood(request(VALID))
    expect(res.status).toBe(401)
  })

  it('402s a free user, naming the paywall it belongs to', async () => {
    useSupabase({ tables: { subscriptions: NO_SUB } })
    const res = await postCustomFood(request(VALID))
    expect(res.status).toBe(402)
    expect(await res.json()).toMatchObject({ upgrade: 'custom_foods' })
  })

  it('500s when the subscription read fails, rather than silently 402ing a real Pro user (F2)', async () => {
    useSupabase({ tables: { subscriptions: { data: null, error: DB_DOWN } } })
    expect((await postCustomFood(request(VALID))).status).toBe(500)
  })

  it('checks the tier before it looks at the body', async () => {
    // A free user sending rubbish must still be told to upgrade, not that their
    // rubbish is malformed — the gate is the outer boundary.
    useSupabase({ tables: { subscriptions: NO_SUB } })
    expect((await postCustomFood(request({ name: 'x' }))).status).toBe(402)
  })

  it('lets a Pro user through', async () => {
    useSupabase({
      tables: { subscriptions: PRO_SUB, foods: { insert: { data: { id: 'f1' }, error: null } } },
    })
    expect((await postCustomFood(request(VALID))).status).toBe(200)
  })

  it('400s a Pro user’s invalid payload', async () => {
    useSupabase({ tables: { subscriptions: PRO_SUB } })
    const res = await postCustomFood(request({ ...VALID, name: 'x' }))
    expect(res.status).toBe(400)
  })

  it('400s macros that exceed 100g per 100g', async () => {
    useSupabase({ tables: { subscriptions: PRO_SUB } })
    const res = await postCustomFood(
      request({ ...VALID, protein_g_per_100g: 50, carbs_g_per_100g: 50, fat_g_per_100g: 50 })
    )
    expect(res.status).toBe(400)
  })

  /**
   * Migration 034's RLS derives ownership from source_id — a row is yours if
   * source='user' and source_id starts with 'user_<uid>_'. If this route ever
   * stops writing that shape, the policy stops matching and every custom food
   * becomes uneditable by the person who made it.
   */
  it('stamps ownership in the shape migration 034’s policy matches', async () => {
    const mock = useSupabase({
      tables: { subscriptions: PRO_SUB, foods: { insert: { data: { id: 'f1' }, error: null } } },
    })
    await postCustomFood(request(VALID))

    const insert = mock.callsTo('foods').find((c) => c.operation === 'insert')
    const row = insert?.payload as { source: string; source_id: string }
    expect(row.source).toBe('user')
    expect(row.source_id.startsWith(`user_${USER.id}_`)).toBe(true)
  })
})

describe('GET /api/export — data portability, not a feature', () => {
  const TABLES = {
    food_logs: { data: [] },
    weight_logs: { data: [] },
  }

  it('401s an unauthenticated request', async () => {
    useSupabase({ user: null, tables: TABLES })
    expect((await getExport()).status).toBe(401)
  })

  /**
   * Ungated on purpose. A free user gets their own data in full — the 7-day
   * limit governs what the app *shows*, never what it will hand back.
   */
  it('serves a free user with no subscription row', async () => {
    useSupabase({ tables: TABLES })
    const res = await getExport()
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
  })

  it('applies no date window to either table', async () => {
    const mock = useSupabase({ tables: TABLES })
    await getExport()

    for (const table of ['food_logs', 'weight_logs']) {
      const filters = mock.callTo(table)?.filters ?? []
      const windowing = filters.filter(([op]) => ['gte', 'gt', 'lte', 'lt'].includes(op))
      expect(windowing, `${table} was windowed`).toEqual([])
    }
  })

  it('never reads the subscriptions table at all', async () => {
    const mock = useSupabase({ tables: TABLES })
    await getExport()
    expect(mock.callsTo('subscriptions')).toEqual([])
  })

  it('scopes both reads to the calling user', async () => {
    const mock = useSupabase({ tables: TABLES })
    await getExport()
    for (const table of ['food_logs', 'weight_logs']) {
      expect(mock.callTo(table)?.filters).toContainEqual(['eq', 'user_id', USER.id])
    }
  })
})

describe('POST /api/streak/rescue — Pro, one a month, server picks the day', () => {
  const NO_LOGS = { data: [] }

  it('403s a free user', async () => {
    useSupabase({
      tables: { subscriptions: NO_SUB, food_logs: NO_LOGS, streak_rescues: { data: [] } },
    })
    expect((await postRescue()).status).toBe(403)
  })

  it('500s when the subscription read fails, rather than silently 403ing a real Pro user (F2)', async () => {
    useSupabase({
      tables: {
        subscriptions: { data: null, error: DB_DOWN },
        food_logs: NO_LOGS,
        streak_rescues: { data: [] },
      },
    })
    expect((await postRescue()).status).toBe(500)
  })

  /** An unreadable rescue list would look like a full allowance. */
  it('500s rather than granting a rescue it could not account for', async () => {
    useSupabase({
      tables: {
        subscriptions: PRO_SUB,
        food_logs: NO_LOGS,
        streak_rescues: { data: null, error: DB_DOWN },
      },
    })
    expect((await postRescue()).status).toBe(500)
  })

  it('409s a Pro user who already spent this month’s rescue', async () => {
    useSupabase({
      tables: {
        subscriptions: PRO_SUB,
        food_logs: NO_LOGS,
        streak_rescues: { data: [{ rescued_date: '2026-07-01', created_at: new Date().toISOString() }] },
      },
    })
    expect((await postRescue()).status).toBe(409)
  })

  it('409s when there is no broken streak to repair', async () => {
    useSupabase({
      tables: { subscriptions: PRO_SUB, food_logs: NO_LOGS, streak_rescues: { data: [] } },
    })
    expect((await postRescue()).status).toBe(409)
  })

  it('never lets the session client write the rescue row', async () => {
    // Migration 028 grants users no insert policy on streak_rescues on purpose:
    // Pro status, the allowance and "is this day rescuable" are all decided
    // here, so the insert must go through the service-role client.
    const mock = useSupabase({
      tables: { subscriptions: PRO_SUB, food_logs: NO_LOGS, streak_rescues: { data: [] } },
    })
    await postRescue()
    expect(mock.callsTo('streak_rescues').some((c) => c.operation === 'insert')).toBe(false)
  })
})
