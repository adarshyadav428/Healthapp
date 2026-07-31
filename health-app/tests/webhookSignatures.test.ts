/**
 * Webhook authentication and lifecycle handling.
 *
 * These two routes are how a subscription's status stays true after the moment
 * of payment: renewals, failures, cancellations and revocations all arrive here
 * and nowhere else. They are also the only unauthenticated write paths in the
 * app — anyone on the internet can POST to them — so the signature check is the
 * whole of their access control, and neither had a test.
 *
 * The Razorpay signature is verified with the real `validateWebhookSignature`,
 * not a mock, and the tests compute genuine HMAC-SHA256 signatures with node
 * crypto. Mocking the verifier would leave the one thing worth proving untested.
 *
 * The two routes answer failure differently, on purpose, and both behaviours
 * are pinned below: Razorpay must 500 so it retries, Play must 200 so Pub/Sub
 * does not retry-storm — which is exactly why a dropped Play write has to reach
 * Sentry instead.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { createSupabaseMock, type MockOptions } from './helpers/supabaseMock'

const createAdminClient = vi.fn()
const captureException = vi.fn()
const getPlaySubscription = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: vi.fn(),
  createAdminClient: () => createAdminClient(),
  getApiUser: vi.fn(),
  getAuthedUser: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}))

vi.mock('../lib/play/verify', () => ({
  getPlaySubscription: (...args: unknown[]) => getPlaySubscription(...args),
}))

const { POST: postRazorpay } = await import('../app/api/razorpay/webhook/route')
const { POST: postRtdn } = await import('../app/api/play/rtdn/route')

const WEBHOOK_SECRET = 'whsec_test_razorpay'
const RTDN_SECRET = 'rtdn_test_secret'
const DB_DOWN = { message: 'connection reset', code: '08006' }

function useAdmin(options: MockOptions = {}) {
  const mock = createSupabaseMock(options)
  createAdminClient.mockReturnValue(mock.client)
  return mock
}

/** Exactly what Razorpay does: HMAC-SHA256 of the raw body, hex. */
function sign(rawBody: string, secret = WEBHOOK_SECRET): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex')
}

function razorpayRequest(rawBody: string, signature?: string) {
  return new Request('http://localhost/api/razorpay/webhook', {
    method: 'POST',
    headers: signature === undefined ? {} : { 'x-razorpay-signature': signature },
    body: rawBody,
  })
}

function razorpayEvent(event: string, entity: Record<string, unknown> = { id: 'sub_123' }) {
  return JSON.stringify({ event, payload: { subscription: { entity } } })
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET
  process.env.PLAY_RTDN_SECRET = RTDN_SECRET
})

describe('POST /api/razorpay/webhook — signature', () => {
  it('accepts a correctly signed body', async () => {
    useAdmin()
    const body = razorpayEvent('subscription.activated')
    const res = await postRazorpay(razorpayRequest(body, sign(body)))
    expect(res.status).toBe(200)
  })

  it('400s a request with no signature header', async () => {
    useAdmin()
    const body = razorpayEvent('subscription.activated')
    expect((await postRazorpay(razorpayRequest(body))).status).toBe(400)
  })

  it('400s a forged signature', async () => {
    useAdmin()
    const body = razorpayEvent('subscription.activated')
    expect((await postRazorpay(razorpayRequest(body, 'deadbeef'))).status).toBe(400)
  })

  it('400s a signature made with the wrong secret', async () => {
    useAdmin()
    const body = razorpayEvent('subscription.activated')
    const res = await postRazorpay(razorpayRequest(body, sign(body, 'attacker-secret')))
    expect(res.status).toBe(400)
  })

  /**
   * The replay/tamper case: a signature genuinely issued by Razorpay, but for a
   * different body. An attacker who captures one webhook must not be able to
   * reuse its signature to cancel — or activate — someone else's subscription.
   */
  it('400s a valid signature attached to a different body', async () => {
    useAdmin()
    const captured = razorpayEvent('subscription.charged', { id: 'sub_victim' })
    const forged = razorpayEvent('subscription.cancelled', { id: 'sub_victim' })
    const res = await postRazorpay(razorpayRequest(forged, sign(captured)))
    expect(res.status).toBe(400)
  })

  it('400s when the webhook secret is not configured', async () => {
    useAdmin()
    delete process.env.RAZORPAY_WEBHOOK_SECRET
    const body = razorpayEvent('subscription.activated')
    // Fails closed: no secret means no verifiable request, not a free pass.
    expect((await postRazorpay(razorpayRequest(body, sign(body)))).status).toBe(400)
  })

  /**
   * The signature must be checked against the bytes that arrived, not against a
   * re-serialised parse of them. Reformatting the body before verifying — a
   * natural-looking refactor — silently breaks every real webhook.
   */
  it('verifies the raw bytes, not a re-serialised body', async () => {
    useAdmin()
    const raw = '{"event":"subscription.activated",\n  "payload":{"subscription":{"entity":{"id":"sub_123"}}}}'
    expect(raw).not.toBe(JSON.stringify(JSON.parse(raw)))
    expect((await postRazorpay(razorpayRequest(raw, sign(raw)))).status).toBe(200)
  })

  it('400s a correctly signed body that is not JSON', async () => {
    useAdmin()
    const raw = 'not json at all'
    expect((await postRazorpay(razorpayRequest(raw, sign(raw)))).status).toBe(400)
  })

  it('writes nothing when the signature fails', async () => {
    const mock = useAdmin()
    const body = razorpayEvent('subscription.cancelled')
    await postRazorpay(razorpayRequest(body, 'deadbeef'))
    expect(mock.calls).toEqual([])
  })
})

describe('POST /api/razorpay/webhook — subscription lifecycle', () => {
  async function deliver(event: string, entity?: Record<string, unknown>) {
    const mock = useAdmin({ tables: { subscriptions: { data: null, error: null } } })
    const body = razorpayEvent(event, entity)
    const res = await postRazorpay(razorpayRequest(body, sign(body)))
    return { mock, res, write: mock.callsTo('subscriptions').find((c) => c.operation === 'update') }
  }

  it('activates on subscription.activated and clears a pending cancellation', async () => {
    const { write } = await deliver('subscription.activated', {
      id: 'sub_123',
      current_end: 1800000000,
    })
    expect(write?.payload).toMatchObject({ status: 'active', cancel_at_period_end: false })
    expect(write?.filters).toContainEqual(['eq', 'razorpay_subscription_id', 'sub_123'])
  })

  it('activates on subscription.charged — a renewal is an entitlement', async () => {
    const { write } = await deliver('subscription.charged', { id: 'sub_123', current_end: 1800000000 })
    expect(write?.payload).toMatchObject({ status: 'active' })
  })

  it('converts current_end from unix seconds to an ISO period end', async () => {
    const { write } = await deliver('subscription.activated', { id: 'sub_123', current_end: 1800000000 })
    expect((write?.payload as any).current_period_end).toBe(new Date(1800000000 * 1000).toISOString())
  })

  it('tolerates a missing current_end', async () => {
    const { write, res } = await deliver('subscription.activated', { id: 'sub_123' })
    expect(res.status).toBe(200)
    expect((write?.payload as any).current_period_end).toBeNull()
  })

  it('marks past_due on subscription.halted', async () => {
    const { write } = await deliver('subscription.halted')
    expect(write?.payload).toMatchObject({ status: 'past_due' })
  })

  it.each(['subscription.cancelled', 'subscription.completed'])('cancels on %s', async (event) => {
    const { write } = await deliver(event)
    expect(write?.payload).toMatchObject({ status: 'canceled' })
  })

  it('acknowledges an event it does not handle without writing', async () => {
    const { res, mock } = await deliver('subscription.pending')
    expect(res.status).toBe(200)
    expect(mock.callsTo('subscriptions')).toEqual([])
  })

  it('acknowledges a known event with no entity without writing', async () => {
    const mock = useAdmin()
    const body = JSON.stringify({ event: 'subscription.charged', payload: {} })
    const res = await postRazorpay(razorpayRequest(body, sign(body)))
    expect(res.status).toBe(200)
    expect(mock.callsTo('subscriptions')).toEqual([])
  })

  /**
   * This route is the authoritative source of subscription truth, and Razorpay
   * retries on a non-2xx. Answering 200 to a write that did not land tells it
   * never to try again: the row keeps its old status, so a cancelled subscriber
   * silently keeps Pro or a renewed one is left looking expired. Money either
   * way — the same reasoning the RTDN route states for its own error checks.
   */
  it('500s on a failed write so Razorpay retries', async () => {
    useAdmin({ tables: { subscriptions: { update: { data: null, error: DB_DOWN } } } })
    const body = razorpayEvent('subscription.cancelled')
    const res = await postRazorpay(razorpayRequest(body, sign(body)))
    expect(res.status).toBe(500)
  })
})

describe('POST /api/play/rtdn — shared-secret guard', () => {
  function rtdnRequest(payload: unknown, secret: string | null = RTDN_SECRET) {
    const url =
      secret === null
        ? 'http://localhost/api/play/rtdn'
        : `http://localhost/api/play/rtdn?secret=${encodeURIComponent(secret)}`
    return new Request(url, { method: 'POST', body: JSON.stringify(payload) })
  }

  /** Pub/Sub push envelope: base64 JSON inside message.data. */
  function notification(inner: unknown) {
    return { message: { data: Buffer.from(JSON.stringify(inner)).toString('base64') } }
  }

  const RENEWAL = notification({
    subscriptionNotification: { purchaseToken: 'tok_123', notificationType: 2 },
  })

  it('403s a request with no secret', async () => {
    useAdmin()
    expect((await postRtdn(rtdnRequest(RENEWAL, null))).status).toBe(403)
  })

  it('403s a wrong secret', async () => {
    useAdmin()
    expect((await postRtdn(rtdnRequest(RENEWAL, 'wrong'))).status).toBe(403)
  })

  it('403s when the secret is not configured', async () => {
    useAdmin()
    delete process.env.PLAY_RTDN_SECRET
    expect((await postRtdn(rtdnRequest(RENEWAL, 'anything'))).status).toBe(403)
  })

  it('writes nothing when the guard rejects', async () => {
    const mock = useAdmin()
    await postRtdn(rtdnRequest(RENEWAL, 'wrong'))
    expect(mock.calls).toEqual([])
    expect(getPlaySubscription).not.toHaveBeenCalled()
  })
})

describe('POST /api/play/rtdn — notification handling', () => {
  function rtdnRequest(payload: unknown) {
    return new Request(`http://localhost/api/play/rtdn?secret=${RTDN_SECRET}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  function notification(inner: unknown) {
    return { message: { data: Buffer.from(JSON.stringify(inner)).toString('base64') } }
  }

  const RENEWAL = notification({ subscriptionNotification: { purchaseToken: 'tok_123' } })
  const KNOWN_TOKEN = { select: { data: { user_id: 'user-1' }, error: null } }

  it('syncs the entitlement from Play for a known token', async () => {
    getPlaySubscription.mockResolvedValue({ status: 'active', expiryTime: '2026-09-01T00:00:00Z' })
    const mock = useAdmin({ tables: { subscriptions: KNOWN_TOKEN } })

    const res = await postRtdn(rtdnRequest(RENEWAL))
    expect(res.status).toBe(200)

    // Play is the source of truth for the status — the notification type is not
    // trusted to say what the subscription now is.
    expect(getPlaySubscription).toHaveBeenCalledWith('tok_123')
    const write = mock.callsTo('subscriptions').find((c) => c.operation === 'update')
    expect(write?.payload).toMatchObject({
      status: 'active',
      current_period_end: '2026-09-01T00:00:00Z',
    })
    expect(write?.filters).toContainEqual(['eq', 'play_purchase_token', 'tok_123'])
  })

  it('acknowledges a test notification without calling Play', async () => {
    useAdmin()
    const res = await postRtdn(rtdnRequest(notification({ testNotification: { version: '1.0' } })))
    expect(res.status).toBe(200)
    expect(getPlaySubscription).not.toHaveBeenCalled()
  })

  it('acknowledges an envelope with no data', async () => {
    useAdmin()
    expect((await postRtdn(rtdnRequest({ message: {} }))).status).toBe(200)
  })

  it('acknowledges a token it has never seen without calling Play', async () => {
    const mock = useAdmin({ tables: { subscriptions: { select: { data: null, error: null } } } })
    const res = await postRtdn(rtdnRequest(RENEWAL))
    expect(res.status).toBe(200)
    expect(getPlaySubscription).not.toHaveBeenCalled()
    expect(mock.callsTo('subscriptions').some((c) => c.operation === 'update')).toBe(false)
  })

  /**
   * The route always answers 200 so Pub/Sub does not redeliver forever. That
   * makes Sentry the ONLY signal that a billing state failed to apply — a
   * dropped RTDN is a subscriber sitting on the wrong entitlement.
   */
  it.each([
    ['the lookup fails', { subscriptions: { select: { data: null, error: DB_DOWN } } }],
    [
      'the write fails',
      { subscriptions: { select: { data: { user_id: 'user-1' }, error: null }, update: { data: null, error: DB_DOWN } } },
    ],
  ])('still 200s when %s, but reports it', async (_label, tables) => {
    getPlaySubscription.mockResolvedValue({ status: 'active', expiryTime: '2026-09-01T00:00:00Z' })
    useAdmin({ tables })

    const res = await postRtdn(rtdnRequest(RENEWAL))
    expect(res.status).toBe(200)
    expect(captureException).toHaveBeenCalledTimes(1)
    expect(captureException.mock.calls[0][1]).toMatchObject({ tags: { route: 'play/rtdn' } })
  })

  it('still 200s when Play itself fails, but reports it', async () => {
    getPlaySubscription.mockRejectedValue(new Error('play api 503'))
    useAdmin({ tables: { subscriptions: KNOWN_TOKEN } })

    expect((await postRtdn(rtdnRequest(RENEWAL))).status).toBe(200)
    expect(captureException).toHaveBeenCalledTimes(1)
  })

  it('still 200s on an undecodable payload, but reports it', async () => {
    useAdmin()
    const res = await postRtdn(rtdnRequest({ message: { data: 'not-valid-base64-json' } }))
    expect(res.status).toBe(200)
    expect(captureException).toHaveBeenCalledTimes(1)
  })

  it('reports nothing when everything works', async () => {
    getPlaySubscription.mockResolvedValue({ status: 'active', expiryTime: '2026-09-01T00:00:00Z' })
    useAdmin({ tables: { subscriptions: KNOWN_TOKEN } })
    await postRtdn(rtdnRequest(RENEWAL))
    expect(captureException).not.toHaveBeenCalled()
  })
})
