/**
 * /api/camera/analyze — the P0-1 guard.
 *
 * lib/camera-nutrition.test.ts pins resolveNutrition() in isolation; this file
 * pins how the ROUTE uses its result, which is where the actual bug shipped:
 * a "pcs" item with no valid per-serving total and no matching catalogue row
 * fell through to a generic upsert that wrote a per-100-GRAM estimate into a
 * column this route (and /api/logs/add-bulk) always reads as per-100-PIECE —
 * a 10-100x calorie error, permanently cached via the upsert's onConflict.
 *
 * The guard added to close it (route.ts: `if (n.unit === 'pcs' && !n.resolvable)`)
 * only fires when there's no DB match to fall back on — the existing DB-match
 * conversion path (existing.serving_size_g / piecesInServing) is unaffected and
 * must keep working exactly as before, so that's pinned here as a regression
 * too, not just the new refusal behaviour.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, PRO_SUB, type MockOptions } from './helpers/supabaseMock'

const createServerClient = vi.fn()
const createAdminClient = vi.fn()
const captureServerEvent = vi.fn()
const captureException = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
  createAdminClient: () => createAdminClient(),
}))
vi.mock('../lib/posthog/server', () => ({ captureServerEvent: (...a: unknown[]) => captureServerEvent(...a) }))
vi.mock('@sentry/nextjs', () => ({ captureException: (...a: unknown[]) => captureException(...a) }))

const { POST } = await import('../app/api/camera/analyze/route')

const USER = { id: 'user-1', email: 'a@b.com' }

/** A catalogue row a "pcs" item can match by name, with a real per-piece rate. */
const WINGS_ROW = {
  id: '33333333-3333-3333-3333-333333333333',
  source: 'restaurant',
  source_id: 'restaurant-hot-wings',
  name: 'Hot Wings',
  brand: null,
  serving_size_g: 150,
  serving_description: '5 pieces (150g)',
  kcal_per_100g: 300,
  protein_g_per_100g: 20,
  carbs_g_per_100g: 5,
  fat_g_per_100g: 22,
  fiber_g_per_100g: null,
  common_portions: null,
}

/** A Gemini-shaped fetch response carrying these `foods` in its JSON text. */
function geminiFoods(foods: unknown[], confidence = 'high') {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ foods, confidence }) }] } }],
    }),
  } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>

function wire(options: {
  serverTables?: MockOptions['tables']
  adminTables?: MockOptions['tables']
} = {}) {
  const serverMock = createSupabaseMock({
    user: USER,
    tables: { subscriptions: PRO_SUB, ...options.serverTables },
  })
  const adminMock = createSupabaseMock({ tables: options.adminTables })
  createServerClient.mockReturnValue(serverMock.client)
  createAdminClient.mockReturnValue(adminMock.client)
  return { serverMock, adminMock }
}

function post(body: unknown) {
  return POST(
    new Request('http://localhost/api/camera/analyze', { method: 'POST', body: JSON.stringify(body) })
  )
}

function upsertPayload(mock: ReturnType<typeof createSupabaseMock>) {
  const upsert = mock.callsTo('foods').find((c) => c.operation === 'upsert')
  return (upsert?.payload as { payload: Record<string, unknown> } | undefined)?.payload
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.GEMINI_API_KEY = 'test-key'
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

describe('/api/camera/analyze — pcs unit guard (P0-1)', () => {
  it('drops a pcs item with no valid total and no DB match, and reports it as unresolved instead of creating a wrong estimate', async () => {
    const { adminMock } = wire({ serverTables: { foods: { select: { data: [] } } } })
    fetchMock.mockResolvedValue(geminiFoods([
      { name: 'Mystery Wings', estimated_grams: 6, unit: 'pcs', kcal_per_100g: 250, protein_g_per_100g: 20, carbs_g_per_100g: 5, fat_g_per_100g: 15 },
    ]))

    const res = await post({ imageBase64: 'abc' })
    expect(res.status).toBe(422)
    const json = await res.json()
    expect(json.error).toContain('Mystery Wings')

    // No wrong-unit estimate row was ever written.
    expect(adminMock.callsTo('foods').some((c) => c.operation === 'upsert')).toBe(false)
  })

  it("still uses the DB match's own per-piece rate when totals are missing (regression: the fallback path must keep working)", async () => {
    const { adminMock } = wire({
      serverTables: { foods: { select: { data: [WINGS_ROW] } } },
      adminTables: {
        foods: { upsert: { data: { ...WINGS_ROW, id: '44444444-4444-4444-4444-444444444444' }, error: null } },
      },
    })
    // No total_kcal/etc. — Gemini gave no per-serving total for this item.
    fetchMock.mockResolvedValue(geminiFoods([
      { name: 'Hot Wings', estimated_grams: 6, unit: 'pcs', kcal_per_100g: 0, protein_g_per_100g: 0, carbs_g_per_100g: 0, fat_g_per_100g: 0 },
    ]))

    const res = await post({ imageBase64: 'abc' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.foods).toHaveLength(1)
    expect(json.unresolved).toBeUndefined()

    // gramsPerPiece = 150 / 5 = 30 → per-100-pieces rate = 300 * 30 = 9000 kcal/100pcs
    const payload = upsertPayload(adminMock)
    expect(payload?.kcal_per_100g).toBe(9000)
    expect(payload?.serving_size_g).toBe(6)
  })

  it('creates a correct estimate row for a pcs item with a valid serving total and no DB match', async () => {
    const { adminMock } = wire({
      serverTables: { foods: { select: { data: [] } } },
      adminTables: {
        foods: { upsert: { data: { id: '55555555-5555-5555-5555-555555555555' }, error: null } },
      },
    })
    fetchMock.mockResolvedValue(geminiFoods([
      { name: 'Samosa', estimated_grams: 2, unit: 'pcs', kcal_per_100g: 0, protein_g_per_100g: 0, carbs_g_per_100g: 0, fat_g_per_100g: 0, total_kcal: 500, total_protein_g: 10, total_carbs_g: 50, total_fat_g: 30 },
    ]))

    const res = await post({ imageBase64: 'abc' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.foods).toHaveLength(1)

    // 500 kcal / 2 pcs × 100 = 25000 kcal/100pcs
    const payload = upsertPayload(adminMock)
    expect(payload?.kcal_per_100g).toBe(25000)
    expect(payload?.serving_size_g).toBe(2)
  })

  it('logs a grams-based food normally (regression: the guard must not touch non-pcs items)', async () => {
    const { adminMock } = wire({
      serverTables: { foods: { select: { data: [] } } },
      adminTables: {
        foods: { upsert: { data: { id: '66666666-6666-6666-6666-666666666666' }, error: null } },
      },
    })
    fetchMock.mockResolvedValue(geminiFoods([
      { name: 'Rice', estimated_grams: 150, unit: 'g', kcal_per_100g: 130, protein_g_per_100g: 2.7, carbs_g_per_100g: 28, fat_g_per_100g: 0.3 },
    ]))

    const res = await post({ imageBase64: 'abc' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.foods).toHaveLength(1)
    expect(json.unresolved).toBeUndefined()

    const payload = upsertPayload(adminMock)
    expect(payload?.kcal_per_100g).toBe(130)
    expect(payload?.serving_size_g).toBe(150)
  })

  it('resolves one item and reports the other as unresolved in the same scan', async () => {
    const { adminMock } = wire({
      serverTables: { foods: { select: { data: [] } } },
      adminTables: {
        foods: { upsert: { data: { id: '77777777-7777-7777-7777-777777777777', name: 'Rice' }, error: null } },
      },
    })
    fetchMock.mockResolvedValue(geminiFoods([
      { name: 'Rice', estimated_grams: 150, unit: 'g', kcal_per_100g: 130, protein_g_per_100g: 2.7, carbs_g_per_100g: 28, fat_g_per_100g: 0.3 },
      { name: 'Mystery Wings', estimated_grams: 6, unit: 'pcs', kcal_per_100g: 250, protein_g_per_100g: 20, carbs_g_per_100g: 5, fat_g_per_100g: 15 },
    ]))

    const res = await post({ imageBase64: 'abc' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.foods).toHaveLength(1)
    expect(json.foods[0].name).toBe('Rice')
    expect(json.unresolved).toEqual(['Mystery Wings'])

    // Only one upsert happened — the unresolved item never reached persistence.
    expect(adminMock.callsTo('foods').filter((c) => c.operation === 'upsert')).toHaveLength(1)
  })
})

/**
 * `foods_select` RLS is open to every signed-in user for the shared
 * catalogue, so the candidate-match query below runs under the CALLER's own
 * session — nothing stops it from returning another user's private
 * `source='user'` custom food if its name happens to match what Gemini
 * guessed. Only the `.neq('source', ...)` filters the route sends can
 * prevent that; this double doesn't evaluate filters against canned data
 * (see tests/helpers/supabaseMock.ts's own docstring), so the exclusion is
 * pinned by asserting the filters actually sent. Audit 2026-09-04, P0-2
 * follow-up.
 */
describe('/api/camera/analyze — excludes other users\' custom foods from name-matching (P0-2 follow-up)', () => {
  it('excludes source=user (as well as source=estimate) from the candidate-match query', async () => {
    const { serverMock } = wire({ serverTables: { foods: { select: { data: [] } } } })
    fetchMock.mockResolvedValue(geminiFoods([
      { name: 'Rice', estimated_grams: 150, unit: 'g', kcal_per_100g: 130, protein_g_per_100g: 2.7, carbs_g_per_100g: 28, fat_g_per_100g: 0.3 },
    ]))
    await post({ imageBase64: 'abc' })

    const candidateQuery = serverMock.callsTo('foods').find((c) => c.operation === 'select')
    expect(candidateQuery?.filters).toContainEqual(['neq', 'source', 'estimate'])
    expect(candidateQuery?.filters).toContainEqual(['neq', 'source', 'user'])
  })
})
