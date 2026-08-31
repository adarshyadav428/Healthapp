/**
 * The success path of the two AI routes now reports how many free scans are
 * left, so the client can render a countdown instead of a wall that only
 * appears at zero.
 *
 * routeAiGate.test.ts pins the DENIAL paths and deliberately rejects every
 * fetch so nothing reaches Gemini. This file is the counterpart: it stubs one
 * successful Gemini call and one food match, and asserts the 200 body carries
 * `remaining` = (scans left before this one) − 1, or `null` for a Pro user.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, NO_SUB, PRO_SUB, type MockOptions } from './helpers/supabaseMock'

const createServerClient = vi.fn()
const createAdminClient = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
  createAdminClient: () => createAdminClient(),
  getApiUser: vi.fn(),
  getAuthedUser: vi.fn(),
}))
vi.mock('../lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))

const { POST: postChat } = await import('../app/api/chat/analyze/route')

const USER = { id: 'user-1', email: 'a@b.com' }
const VERIFIED = { data: { email_verified_at: '2026-07-20T10:00:00Z' }, error: null }

const DAL = {
  id: 'f-dal',
  source: 'ifct',
  source_id: 'ifct-dal',
  name: 'dal',
  brand: null,
  serving_size_g: 100,
  serving_description: '1 katori',
  kcal_per_100g: 120,
  protein_g_per_100g: 8,
  carbs_g_per_100g: 15,
  fat_g_per_100g: 2,
  fiber_g_per_100g: 1,
  common_portions: null,
}

/** A Gemini response the route can parse straight through to a food match. */
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

describe('POST /api/chat/analyze — remaining on the success body', () => {
  it('a free user with two scans left gets remaining: 1 (one spent by this scan)', async () => {
    useSupabase({
      tables: {
        subscriptions: NO_SUB,
        profiles: VERIFIED,
        camera_photo_logs: { count: 0 },
        chat_logs: { count: 1 }, // one already used → decideAiTrial.remaining = 2
        foods: { data: [DAL] },
      },
    })
    const res = await postChat(chatRequest())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ meal: 'lunch', remaining: 1 })
  })

  it('a free user on their first scan gets remaining: 2', async () => {
    useSupabase({
      tables: {
        subscriptions: NO_SUB,
        profiles: VERIFIED,
        camera_photo_logs: { count: 0 },
        chat_logs: { count: 0 },
        foods: { data: [DAL] },
      },
    })
    const res = await postChat(chatRequest())
    expect(await res.json()).toMatchObject({ remaining: 2 })
  })

  it('a Pro user gets remaining: null — the client must never show them a number', async () => {
    useSupabase({
      tables: {
        subscriptions: PRO_SUB,
        profiles: VERIFIED,
        foods: { data: [DAL] },
      },
    })
    const res = await postChat(chatRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.remaining).toBeNull()
  })
})
