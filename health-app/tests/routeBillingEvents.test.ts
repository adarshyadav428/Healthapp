/**
 * Subscription-lifecycle analytics.
 *
 * The growth-advice audit's biggest instrumentation hole: the funnel ended at
 * purchase *intent* (`upgrade_completed` fires the moment a checkout returns) —
 * it could never see a Play trial convert to paid, or a subscriber cancel.
 * These tests pin the new server-side emits on the billing routes and webhooks.
 *
 * `captureServerEvent` is mocked so the assertions are on "what event, with
 * what props" rather than on PostHog transport.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { createSupabaseMock, type MockOptions } from './helpers/supabaseMock'

const captureServerEvent = vi.fn()
const createServerClient = vi.fn()
const createAdminClient = vi.fn()
const getPlaySubscription = vi.fn()
const acknowledgePlaySubscription = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
  createAdminClient: () => createAdminClient(),
  getAuthedUser: vi.fn(),
  getApiUser: vi.fn(),
}))

vi.mock('../lib/posthog/server', () => ({
  captureServerEvent: (...args: unknown[]) => captureServerEvent(...args),
}))

vi.mock('../lib/play/verify', () => ({
  getPlaySubscription: (...args: unknown[]) => getPlaySubscription(...args),
  acknowledgePlaySubscription: (...args: unknown[]) => acknowledgePlaySubscription(...args),
}))

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }))

vi.mock('razorpay/dist/utils/razorpay-utils', () => ({
  validateWebhookSignature: (body: string, sig: string, secret: string) =>
    sig === createHmac('sha256', secret).update(body).digest('hex'),
  validatePaymentVerification: () => true,
}))

const { POST: postPlayVerify } = await import('../app/api/play/verify/route')
const { POST: postRtdn } = await import('../app/api/play/rtdn/route')
const { POST: postRazorpayVerify } = await import('../app/api/razorpay/verify/route')
const { POST: postRazorpayWebhook } = await import('../app/api/razorpay/webhook/route')

const USER = { id: 'user-1', email: 'a@b.com' }
const SIGNED_UP_5_DAYS_AGO = new Date(Date.now() - 5 * 86_400_000).toISOString()
const RTDN_SECRET = 'rtdn_test'
const RZP_SECRET = 'whsec_rzp'

beforeEach(() => {
  vi.clearAllMocks()
  process.env.PLAY_RTDN_SECRET = RTDN_SECRET
  process.env.RAZORPAY_WEBHOOK_SECRET = RZP_SECRET
  process.env.RAZORPAY_KEY_SECRET = 'rzp_key_secret'
})

/** Server client sees the caller + their profile; admin client sees subscriptions. */
function wire(serverTables: MockOptions['tables'], adminTables: MockOptions['tables']) {
  const server = createSupabaseMock({ user: USER, tables: serverTables })
  const admin = createSupabaseMock({ user: USER, tables: adminTables })
  createServerClient.mockReturnValue(server.client)
  createAdminClient.mockReturnValue(admin.client)
  return { server, admin }
}

const emitted = (event: string) =>
  captureServerEvent.mock.calls.filter((c) => c[1] === event).map((c) => c[2])

describe('POST /api/play/verify', () => {
  const body = JSON.stringify({ purchaseToken: 'tok_1', productId: 'pro_monthly' })
  const req = () => new Request('http://localhost/api/play/verify', { method: 'POST', body })

  it('emits trial_started and days_since_signup on a trial purchase', async () => {
    getPlaySubscription.mockResolvedValue({
      entitled: true,
      needsAcknowledgement: false,
      status: 'trialing',
      expiryTime: '2026-09-05T00:00:00Z',
    })
    wire(
      { profiles: { data: { created_at: SIGNED_UP_5_DAYS_AGO } } },
      { subscriptions: { select: { data: null }, upsert: { error: null } } },
    )

    const res = await postPlayVerify(req())
    expect(res.status).toBe(200)

    expect(emitted('upgrade_completed')[0]).toMatchObject({
      provider: 'google_play',
      plan: 'monthly',
      days_since_signup: 5,
    })
    expect(emitted('trial_started')[0]).toMatchObject({ provider: 'google_play', plan: 'monthly' })
  })

  it('does not emit trial_started when the purchase is already active', async () => {
    getPlaySubscription.mockResolvedValue({
      entitled: true,
      needsAcknowledgement: false,
      status: 'active',
      expiryTime: '2026-09-05T00:00:00Z',
    })
    wire(
      { profiles: { data: { created_at: SIGNED_UP_5_DAYS_AGO } } },
      { subscriptions: { select: { data: null }, upsert: { error: null } } },
    )

    await postPlayVerify(req())
    expect(emitted('trial_started')).toHaveLength(0)
    expect(emitted('upgrade_completed')).toHaveLength(1)
  })
})

describe('POST /api/play/rtdn', () => {
  const push = (inner: unknown) =>
    new Request(`http://localhost/api/play/rtdn?secret=${RTDN_SECRET}`, {
      method: 'POST',
      body: JSON.stringify({
        message: { data: Buffer.from(JSON.stringify(inner)).toString('base64') },
      }),
    })

  it('emits trial_converted when a trialing row goes active', async () => {
    getPlaySubscription.mockResolvedValue({ status: 'active', expiryTime: '2026-10-01T00:00:00Z' })
    wire(
      {},
      { subscriptions: { select: { data: { user_id: 'user-1', status: 'trialing' } }, update: { error: null } } },
    )

    const res = await postRtdn(push({ subscriptionNotification: { purchaseToken: 'tok_1', notificationType: 4 } }))
    expect(res.status).toBe(200)
    expect(emitted('trial_converted')[0]).toMatchObject({ provider: 'google_play' })
  })

  it('emits subscription_cancelled when Play reports the sub canceled', async () => {
    getPlaySubscription.mockResolvedValue({ status: 'canceled', expiryTime: null })
    wire(
      {},
      { subscriptions: { select: { data: { user_id: 'user-1', status: 'active' } }, update: { error: null } } },
    )

    await postRtdn(push({ subscriptionNotification: { purchaseToken: 'tok_1', notificationType: 3 } }))
    expect(emitted('subscription_cancelled')[0]).toMatchObject({ provider: 'google_play', reason: 'rtdn' })
  })

  it('emits subscription_refunded on a SUBSCRIPTION_REVOKED (type 12)', async () => {
    getPlaySubscription.mockResolvedValue({ status: 'canceled', expiryTime: null })
    wire(
      {},
      { subscriptions: { select: { data: { user_id: 'user-1', status: 'active' } }, update: { error: null } } },
    )

    await postRtdn(push({ subscriptionNotification: { purchaseToken: 'tok_1', notificationType: 12 } }))
    expect(emitted('subscription_refunded')[0]).toMatchObject({ provider: 'google_play' })
  })

  it('emits nothing when the status is unchanged', async () => {
    getPlaySubscription.mockResolvedValue({ status: 'active', expiryTime: '2026-10-01T00:00:00Z' })
    wire(
      {},
      { subscriptions: { select: { data: { user_id: 'user-1', status: 'active' } }, update: { error: null } } },
    )

    await postRtdn(push({ subscriptionNotification: { purchaseToken: 'tok_1', notificationType: 2 } }))
    expect(captureServerEvent).not.toHaveBeenCalled()
  })
})

describe('POST /api/razorpay/webhook', () => {
  const sign = (b: string) => createHmac('sha256', RZP_SECRET).update(b).digest('hex')
  const deliver = (event: string) => {
    const body = JSON.stringify({ event, payload: { subscription: { entity: { id: 'sub_1' } } } })
    return new Request('http://localhost/api/razorpay/webhook', {
      method: 'POST',
      headers: { 'x-razorpay-signature': sign(body) },
      body,
    })
  }

  it('emits subscription_cancelled with the resolved user_id', async () => {
    wire({}, { subscriptions: { update: { data: { user_id: 'user-1' }, error: null } } })

    const res = await postRazorpayWebhook(deliver('subscription.cancelled'))
    expect(res.status).toBe(200)
    expect(emitted('subscription_cancelled')[0]).toMatchObject({
      provider: 'razorpay',
      reason: 'subscription.cancelled',
    })
  })

  it('does not emit when the update matched no row', async () => {
    wire({}, { subscriptions: { update: { data: null, error: null } } })
    await postRazorpayWebhook(deliver('subscription.completed'))
    expect(emitted('subscription_cancelled')).toHaveLength(0)
  })
})

describe('POST /api/razorpay/verify', () => {
  it('adds days_since_signup to upgrade_completed', async () => {
    wire(
      { profiles: { data: { created_at: SIGNED_UP_5_DAYS_AGO } } },
      { subscriptions: { upsert: { error: null } } },
    )
    const body = JSON.stringify({
      razorpay_payment_id: 'pay_1',
      razorpay_subscription_id: 'sub_1',
      razorpay_signature: 'sig',
      plan: 'annual',
    })
    const res = await postRazorpayVerify(
      new Request('http://localhost/api/razorpay/verify', { method: 'POST', body }),
    )
    expect(res.status).toBe(200)
    expect(emitted('upgrade_completed')[0]).toMatchObject({
      provider: 'razorpay',
      plan: 'annual',
      days_since_signup: 5,
    })
  })
})
