/**
 * The AI trial gate, asserted at the two routes that enforce it.
 *
 * CLAUDE.md is explicit that "the UI is not the boundary" for camera and chat:
 * both are reachable directly, every call is a billed Gemini request, and the
 * allowance is lifetime precisely because an account costs an abuser nothing.
 * That makes these two 403s the actual enforcement point for the whole AI
 * budget, and neither had a test.
 *
 * aiTrialServer.test.ts pins the *decision*. This file pins the *wiring*: that
 * the routes ask, that they refuse on the answer, that they refuse before doing
 * any paid work, and that they tell the paywall which block it was — the
 * `unverified` / `exhausted` split drives which copy the user sees, and
 * collapsing it would show "you've used them up" to someone whose real problem
 * is an unconfirmed inbox.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, NO_SUB, PRO_SUB, type MockOptions } from './helpers/supabaseMock'
import { AI_TRIAL_SCANS } from '../lib/aiTrial'

const createServerClient = vi.fn()
const createAdminClient = vi.fn()
const captureServerEvent = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
  createAdminClient: () => createAdminClient(),
  getApiUser: vi.fn(),
  getAuthedUser: vi.fn(),
}))

vi.mock('../lib/posthog/server', () => ({
  captureServerEvent: (...args: unknown[]) => captureServerEvent(...args),
}))

const { POST: postCamera } = await import('../app/api/camera/analyze/route')
const { POST: postChat } = await import('../app/api/chat/analyze/route')

const USER = { id: 'user-1', email: 'a@b.com' }
const VERIFIED = { data: { email_verified_at: '2026-07-20T10:00:00Z' }, error: null }
const UNVERIFIED = { data: { email_verified_at: null }, error: null }
const DB_DOWN = { message: 'relation "chat_logs" does not exist', code: '42P01' }

/**
 * Both routes take a JSON body. The gate runs before the body is read, so a
 * blocked request never needs a valid one — which is itself the point of the
 * "refuses before any paid work" test below.
 */
function cameraRequest(body: unknown = { imageBase64: 'AAAA' }) {
  return new Request('http://localhost/api/camera/analyze', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

function chatRequest(body: unknown = { message: '2 roti and dal' }) {
  return new Request('http://localhost/api/chat/analyze', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const ROUTES = [
  ['camera', postCamera, cameraRequest, 'camera_scan_pro'],
  ['chat', postChat, chatRequest, 'chat_scan_pro'],
] as const

function useSupabase(options: MockOptions = {}) {
  const mock = createSupabaseMock({ user: USER, ...options })
  createServerClient.mockReturnValue(mock.client)
  createAdminClient.mockReturnValue(mock.client)
  return mock
}

/** Free tier, email confirmed, `used` of the lifetime pool already spent. */
function freeWithUsage(used: number) {
  return {
    subscriptions: NO_SUB,
    profiles: VERIFIED,
    camera_photo_logs: { count: used },
    chat_logs: { count: 0 },
  }
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  // Nothing here should ever reach Gemini. Anything that does is a test
  // asserting the gate opened when it should have stayed shut.
  fetchSpy = vi.fn(() => Promise.reject(new Error('network call escaped the gate')))
  vi.stubGlobal('fetch', fetchSpy)
  process.env.GEMINI_API_KEY = 'test-key'
})

describe.each(ROUTES)('POST /api/%s/analyze — the AI trial gate', (name, handler, request, source) => {
  it('401s an unauthenticated request', async () => {
    useSupabase({ user: null })
    expect((await handler(request())).status).toBe(401)
  })

  it('403s a free user who has spent the lifetime pool', async () => {
    useSupabase({ tables: freeWithUsage(AI_TRIAL_SCANS) })
    const res = await handler(request())
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ upgrade: true, block: 'exhausted' })
  })

  it('403s an unverified free user with the verify block, not the exhausted one', async () => {
    useSupabase({
      tables: {
        subscriptions: NO_SUB,
        profiles: UNVERIFIED,
        camera_photo_logs: { count: 0 },
        chat_logs: { count: 0 },
      },
    })
    const res = await handler(request())
    expect(res.status).toBe(403)

    const body = await res.json()
    expect(body.block).toBe('unverified')
    // The copy must name the reward, since that is what makes confirming worth
    // doing — a bare "verify your email" is the housekeeping request people skip.
    expect(body.error).toContain(String(AI_TRIAL_SCANS))
  })

  /** The money test: an unreadable counter must not read as an unused pool. */
  it('403s when the usage count cannot be read', async () => {
    useSupabase({
      tables: {
        subscriptions: NO_SUB,
        profiles: VERIFIED,
        camera_photo_logs: { count: 0 },
        chat_logs: { data: null, count: null, error: DB_DOWN },
      },
    })
    expect((await handler(request())).status).toBe(403)
  })

  it('403s when the subscription read fails — an unreadable tier is not Pro', async () => {
    useSupabase({
      tables: {
        subscriptions: { data: null, error: DB_DOWN },
        profiles: VERIFIED,
        camera_photo_logs: { count: AI_TRIAL_SCANS },
        chat_logs: { count: 0 },
      },
    })
    expect((await handler(request())).status).toBe(403)
  })

  it('spends nothing on a blocked request', async () => {
    useSupabase({ tables: freeWithUsage(AI_TRIAL_SCANS) })
    await handler(request())
    // No Gemini call, so no bill — the gate is in front of the cost, not behind it.
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('blocks a malformed request from a blocked user with 403, not 400', async () => {
    // The tier gate is the outer boundary: a free user must be told to upgrade
    // rather than have their body validated first.
    useSupabase({ tables: freeWithUsage(AI_TRIAL_SCANS) })
    expect((await handler(request({}))).status).toBe(403)
  })

  it('reports the paywall view with the block that caused it', async () => {
    useSupabase({ tables: freeWithUsage(AI_TRIAL_SCANS) })
    await handler(request())

    expect(captureServerEvent).toHaveBeenCalledWith(
      USER.id,
      'paywall_viewed',
      expect.objectContaining({ source, block: 'exhausted' })
    )
  })

  it('lets a free user with calls remaining past the gate', async () => {
    useSupabase({ tables: freeWithUsage(AI_TRIAL_SCANS - 1) })
    const res = await handler(request())
    // Past the gate it hits the stubbed fetch and fails — but not with a 403,
    // which is the only thing this test is about.
    expect(res.status).not.toBe(403)
  })

  it('does not check the trial for a Pro user at all', async () => {
    const mock = useSupabase({
      tables: {
        subscriptions: PRO_SUB,
        profiles: UNVERIFIED,
        camera_photo_logs: { count: 999 },
        chat_logs: { count: 999 },
      },
    })
    const res = await handler(request())

    expect(res.status).not.toBe(403)
    // Pro is unlimited: an exhausted, unverified counter is irrelevant, and
    // reading it would be wasted work on every scan.
    expect(mock.callsTo('camera_photo_logs')).toEqual([])
    expect(mock.callsTo('chat_logs')).toEqual([])
  })
})
