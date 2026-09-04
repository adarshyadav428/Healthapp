/**
 * Pins the two undestructured-error reads that were fixed in
 * app/api/chat/analyze/route.ts (CLAUDE.md: "Destructure `error` on every
 * read whose emptiness means something"). Mirrors camera/analyze's existing
 * behaviour, asserted the same way routeAiScansRemaining.test.ts asserts the
 * success path: stub one Gemini response, stub Supabase, import the real
 * route handler.
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

const { POST: postChat } = await import('../app/api/chat/analyze/route')

const USER = { id: 'user-1', email: 'a@b.com' }
const VERIFIED = { data: { email_verified_at: '2026-07-20T10:00:00Z' }, error: null }
const DB_DOWN = { message: 'relation "foods" does not exist', code: '42P01' }

const CREATED_ESTIMATE = {
  id: 'f-new',
  source: 'estimate',
  source_id: 'est_dal',
  name: 'dal',
  brand: null,
  serving_size_g: 150,
  serving_description: '1 katori',
  kcal_per_100g: 120,
  protein_g_per_100g: 8,
  carbs_g_per_100g: 15,
  fat_g_per_100g: 2,
  fiber_g_per_100g: null,
  common_portions: null,
}

function geminiOk() {
  return {
    ok: true,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  meal: 'lunch',
                  items: [
                    {
                      name: 'dal',
                      portion_desc: '1 katori',
                      grams: 150,
                      kcal_per_100g: 120,
                      protein_g_per_100g: 8,
                      carbs_g_per_100g: 15,
                      fat_g_per_100g: 2,
                    },
                  ],
                }),
              },
            ],
          },
        },
      ],
    }),
  }
}

function useSupabase(options: MockOptions = {}) {
  const mock = createSupabaseMock({ user: USER, ...options })
  createServerClient.mockReturnValue(mock.client)
  createAdminClient.mockReturnValue(mock.client)
  return mock
}

function chatRequest() {
  return new Request('http://localhost/api/chat/analyze', {
    method: 'POST',
    body: JSON.stringify({ message: '1 katori dal', currentTime: '13:00' }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(geminiOk() as unknown as Response)))
  process.env.GEMINI_API_KEY = 'test-key'
})

describe('POST /api/chat/analyze — foods table error handling', () => {
  it('degrades gracefully when the candidate-match read fails, instead of crashing or silently duplicating', async () => {
    useSupabase({
      tables: {
        subscriptions: NO_SUB,
        profiles: VERIFIED,
        camera_photo_logs: { count: 0 },
        chat_logs: { count: 0 },
        foods: {
          select: { data: null, error: DB_DOWN },
          upsert: { data: CREATED_ESTIMATE, error: null },
        },
      },
    })
    const res = await postChat(chatRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(1)
  })

  it('500s with a message when the estimate upsert fails, instead of dropping the item silently', async () => {
    useSupabase({
      tables: {
        subscriptions: NO_SUB,
        profiles: VERIFIED,
        camera_photo_logs: { count: 0 },
        chat_logs: { count: 0 },
        foods: {
          select: { data: [], error: null },
          upsert: { data: null, error: DB_DOWN },
        },
      },
    })
    const res = await postChat(chatRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('DB upsert failed')
  })
})
