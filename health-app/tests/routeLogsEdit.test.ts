/**
 * /api/logs/edit — R7 (2026-09-13 remediation).
 *
 * QA confirmed a fabricated kcal (grams:105, kcal:4999 for a food whose true
 * 105g value is 311.85 kcal) was accepted verbatim and propagated to Home.
 * The fix: recompute kcal/macros server-side from the linked food's
 * per-100g values whenever the row has one (search, camera, chat and
 * saved-combo entries all do) — the client's kcal/macro fields are only
 * trusted for a true quick-add row (food_id NULL, migration 009), which has
 * no per-100g source to recompute from.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, type MockOptions } from './helpers/supabaseMock'

const createServerClient = vi.fn()
const getApiUser = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
  getApiUser: () => getApiUser(),
}))

const { PATCH } = await import('../app/api/logs/edit/route')

const USER = { id: 'user-1', email: 'a@b.com' }

const ROTI = {
  kcal_per_100g: 297,
  protein_g_per_100g: 9.2,
  carbs_g_per_100g: 62,
  fat_g_per_100g: 2.9,
}

function wire(options: MockOptions = {}) {
  const mock = createSupabaseMock({
    user: USER,
    tables: {
      food_logs: {
        select: { data: { id: LOG_ID, food: ROTI } },
        update: { data: null, error: null },
      },
    },
    ...options,
  })
  createServerClient.mockReturnValue(mock.client)
  getApiUser.mockResolvedValue(USER)
  return mock
}

const LOG_ID = '11111111-1111-1111-1111-111111111111'

function patch(body: Record<string, unknown>) {
  return PATCH(
    new Request('http://localhost/api/logs/edit', {
      method: 'PATCH',
      body: JSON.stringify({
        id: LOG_ID,
        grams: 105,
        servings: 1,
        meal: 'lunch',
        kcal: 100,
        protein_g: 5,
        carbs_g: 10,
        fat_g: 1,
        ...body,
      }),
    })
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('/api/logs/edit — server-side recompute (R7)', () => {
  it('a valid edit persists the recomputed macros for the linked food', async () => {
    const mock = wire()
    const res = await patch({ grams: 100 })
    expect(res.status).toBe(200)
    const update = mock.callsTo('food_logs').find((c) => c.operation === 'update')
    const payload = update?.payload as { kcal: number }
    // 297 kcal/100g × 100g = 297, not the client's fabricated 100
    expect(payload.kcal).toBe(297)
  })

  it('ignores a fabricated kcal and recomputes from food_id + grams', async () => {
    const mock = wire()
    // True value for 105g of this food is 311.85 kcal — the client sends 4999.
    const res = await patch({ grams: 105, kcal: 4999 })
    expect(res.status).toBe(200)
    const update = mock.callsTo('food_logs').find((c) => c.operation === 'update')
    const payload = update?.payload as { kcal: number }
    expect(payload.kcal).toBe(311.85)
    expect(payload.kcal).not.toBe(4999)
  })

  it('ignores fabricated macros the same way as kcal', async () => {
    const mock = wire()
    const res = await patch({ grams: 105, protein_g: 500, carbs_g: 1000, fat_g: 500 })
    expect(res.status).toBe(200)
    const update = mock.callsTo('food_logs').find((c) => c.operation === 'update')
    const payload = update?.payload as { protein_g: number; carbs_g: number; fat_g: number }
    expect(payload.protein_g).toBe(9.66)
    expect(payload.carbs_g).toBe(65.1)
    expect(payload.fat_g).toBe(3.05)
  })

  it('a quantity change recomputes proportionally', async () => {
    const mock = wire()
    await patch({ grams: 210 }) // double
    const update = mock.callsTo('food_logs').find((c) => c.operation === 'update')
    const payload = update?.payload as { kcal: number }
    expect(payload.kcal).toBe(623.7) // 297 × 2.1
  })

  it('trusts the client-sent kcal only for a food_id-NULL quick-add row', async () => {
    const mock = wire({ tables: { food_logs: { select: { data: { id: 'log-2', food: null } }, update: { data: null, error: null } } } })
    const res = await patch({ kcal: 450, protein_g: 20, carbs_g: 30, fat_g: 10 })
    expect(res.status).toBe(200)
    const update = mock.callsTo('food_logs').find((c) => c.operation === 'update')
    const payload = update?.payload as { kcal: number; protein_g: number }
    expect(payload.kcal).toBe(450)
    expect(payload.protein_g).toBe(20)
  })

  it('scopes both the read and the write to the caller (never another user\'s row)', async () => {
    const mock = wire()
    await patch({})
    const select = mock.callsTo('food_logs').find((c) => c.operation === 'select')
    const update = mock.callsTo('food_logs').find((c) => c.operation === 'update')
    expect(select?.filters).toContainEqual(['eq', 'user_id', USER.id])
    expect(update?.filters).toContainEqual(['eq', 'user_id', USER.id])
  })

  it('404s rather than 500s when the entry does not exist (or is not the caller\'s)', async () => {
    const mock = wire({ tables: { food_logs: { select: { data: null }, update: { data: null, error: null } } } })
    const res = await patch({})
    expect(res.status).toBe(404)
    expect(mock.callsTo('food_logs').some((c) => c.operation === 'update')).toBe(false)
  })

  it('rejects an out-of-bounds grams value before ever reading the row', async () => {
    const mock = wire()
    const res = await patch({ grams: 50000 })
    expect(res.status).toBe(400)
    expect(mock.callsTo('food_logs').length).toBe(0)
  })
})
