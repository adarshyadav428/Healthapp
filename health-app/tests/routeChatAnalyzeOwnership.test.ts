/**
 * /api/chat/analyze — excludes other users' custom foods from name-matching.
 *
 * Same defect and same fix as /api/camera/analyze (see
 * tests/routeCameraAnalyze.test.ts's equivalent describe block): this route's
 * candidate-match query ran under the caller's own session against
 * `foods_select` RLS that's open to every signed-in user, and only excluded
 * `source='estimate'` — never `source='user'`. A chat message naming a dish
 * the same way another user named their private custom food could surface
 * (and then log) that private food. Audit 2026-09-04, P0-2 follow-up.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, NO_SUB, type MockOptions } from './helpers/supabaseMock'

const createServerClient = vi.fn()
const createAdminClient = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
  createAdminClient: () => createAdminClient(),
  getApiUser: vi.fn(),
  getAuthedUser: vi.fn(),
}))
vi.mock('../lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

const { POST } = await import('../app/api/chat/analyze/route')

const USER = { id: 'user-1', email: 'a@b.com' }

function geminiOk() {
  return {
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              meal: 'lunch',
              items: [{ name: 'dal', portion_desc: '1 katori', grams: 150, kcal_per_100g: 120, protein_g_per_100g: 8, carbs_g_per_100g: 15, fat_g_per_100g: 2 }],
            }),
          }],
        },
      }],
    }),
  } as unknown as Response
}

function wire(options: MockOptions = {}) {
  const mock = createSupabaseMock({
    user: USER,
    tables: { subscriptions: NO_SUB, profiles: { data: { email_verified_at: '2026-07-20T10:00:00Z' } }, foods: { select: { data: [] } } },
    ...options,
  })
  createServerClient.mockReturnValue(mock.client)
  createAdminClient.mockReturnValue(mock.client)
  return mock
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(geminiOk())))
  process.env.GEMINI_API_KEY = 'test-key'
})

describe('POST /api/chat/analyze — ownership (P0-2 follow-up)', () => {
  it('excludes source=user (as well as source=estimate) from the candidate-match query', async () => {
    const mock = wire()
    await POST(
      new Request('http://localhost/api/chat/analyze', {
        method: 'POST',
        body: JSON.stringify({ message: '1 katori dal', currentTime: '13:00' }),
      })
    )

    const candidateQuery = mock.callsTo('foods').find((c) => c.operation === 'select')
    expect(candidateQuery?.filters).toContainEqual(['neq', 'source', 'estimate'])
    expect(candidateQuery?.filters).toContainEqual(['neq', 'source', 'user'])
  })
})
