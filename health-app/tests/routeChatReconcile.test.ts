/**
 * End-to-end regression for the bug that started this: a stated total plus
 * explicitly-quantified components must not double-count. chatLogEval.test.ts
 * pins the pure arithmetic; this pins that the real route actually calls it
 * and returns the corrected numbers over the wire.
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

/** No DB match for any of the three names — every item takes the create-estimate path. */
function geminiBiryani() {
  return {
    ok: true,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  meal: 'dinner',
                  assumptions: '',
                  items: [
                    {
                      name: 'Hyderabadi Chicken Biryani',
                      portion_desc: '750g',
                      grams: 750,
                      kcal_per_100g: 175,
                      protein_g_per_100g: 8,
                      carbs_g_per_100g: 20,
                      fat_g_per_100g: 6,
                    },
                    {
                      name: 'Chicken Piece',
                      portion_desc: '6 medium pieces',
                      grams: 300,
                      is_stated_component: true,
                      kcal_per_100g: 165,
                      protein_g_per_100g: 31,
                      carbs_g_per_100g: 0,
                      fat_g_per_100g: 3.6,
                    },
                    {
                      name: 'Mixed Vegetable Gravy',
                      portion_desc: 'a little',
                      grams: 50,
                      is_stated_component: true,
                      kcal_per_100g: 134,
                      protein_g_per_100g: 9,
                      carbs_g_per_100g: 5.4,
                      fat_g_per_100g: 8.6,
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

function chatRequest(message = '750g of Hyderabadi chicken biryani which contained 6 medium chicken pieces along with some gravy') {
  return new Request('http://localhost/api/chat/analyze', {
    method: 'POST',
    body: JSON.stringify({ message, currentTime: '20:00' }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(geminiBiryani() as unknown as Response)))
  process.env.GEMINI_API_KEY = 'test-key'
})

describe('POST /api/chat/analyze — stated-total rebalancing end-to-end', () => {
  it('subtracts explicit components from the stated total instead of double-counting', async () => {
    useSupabase({
      tables: {
        subscriptions: NO_SUB,
        profiles: VERIFIED,
        camera_photo_logs: { count: 0 },
        chat_logs: { count: 0 },
        foods: {
          select: { data: [], error: null },
          upsert: [
            { data: { id: 'f1', kcal_per_100g: 175, protein_g_per_100g: 8, carbs_g_per_100g: 20, fat_g_per_100g: 6 }, error: null },
            { data: { id: 'f2', kcal_per_100g: 165, protein_g_per_100g: 31, carbs_g_per_100g: 0, fat_g_per_100g: 3.6 }, error: null },
            { data: { id: 'f3', kcal_per_100g: 134, protein_g_per_100g: 9, carbs_g_per_100g: 5.4, fat_g_per_100g: 8.6 }, error: null },
          ],
        },
      },
    })

    const res = await postChat(chatRequest())
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.items).toHaveLength(3)
    const totalGrams = body.items.reduce((sum: number, i: { grams: number }) => sum + i.grams, 0)
    expect(totalGrams).toBe(750)
    // The base item (biryani) absorbed the remainder; the two components
    // (chicken, gravy) kept the grams the user actually gave them.
    expect(body.items[0].grams).toBe(400)
    expect(body.items[1].grams).toBe(300)
    expect(body.items[2].grams).toBe(50)
    expect(body.assumptions).toBeTruthy()
  })

  it('does nothing when the message states no single total (a genuine multi-dish list)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
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
                          { name: 'Roti', portion_desc: '2 medium', grams: 80, kcal_per_100g: 297, protein_g_per_100g: 8.1, carbs_g_per_100g: 61, fat_g_per_100g: 3.7 },
                          { name: 'Dal', portion_desc: '1 katori', grams: 150, kcal_per_100g: 120, protein_g_per_100g: 8, carbs_g_per_100g: 15, fat_g_per_100g: 2 },
                        ],
                      }),
                    },
                  ],
                },
              },
            ],
          }),
        } as unknown as Response)
      )
    )
    useSupabase({
      tables: {
        subscriptions: NO_SUB,
        profiles: VERIFIED,
        camera_photo_logs: { count: 0 },
        chat_logs: { count: 0 },
        foods: {
          select: { data: [], error: null },
          upsert: [
            { data: { id: 'f1', kcal_per_100g: 297, protein_g_per_100g: 8.1, carbs_g_per_100g: 61, fat_g_per_100g: 3.7 }, error: null },
            { data: { id: 'f2', kcal_per_100g: 120, protein_g_per_100g: 8, carbs_g_per_100g: 15, fat_g_per_100g: 2 }, error: null },
          ],
        },
      },
    })

    const res = await postChat(chatRequest('2 roti and dal'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(2)
    expect(body.assumptions).toBeNull()
  })
})
