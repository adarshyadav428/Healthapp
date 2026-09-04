/**
 * /api/stripe/webhook — the P1-2 fix.
 *
 * Stripe is the legacy billing provider (CLAUDE.md: "read-only"), but this
 * webhook is still the only thing that keeps a legacy subscriber's `status`
 * true — renewals, failures and cancellations all arrive here. Unlike the
 * Razorpay and Play webhooks (tests/webhookSignatures.test.ts), which both
 * already check every write, this route's three `admin.from('subscriptions')`
 * calls didn't even capture a return value: `await admin.from(...).upsert(...)`
 * with nothing on the left of `=`. supabase-js RESOLVES with `{ error }` on a
 * failed write rather than throwing, so a write that never landed still hit
 * the route's `return NextResponse.json({ received: true })` — Stripe never
 * retries a 200, so a cancelled legacy subscriber could silently stay Pro
 * forever, or a failed payment never get flagged `past_due`.
 *
 * Real signature verification is exercised for Razorpay in
 * webhookSignatures.test.ts; Stripe's own scheme (a timestamped `v1=` HMAC,
 * verified by the Stripe SDK itself) isn't the thing this fix touches, so
 * `getStripeClient` is stubbed to skip straight to the parsed event, the same
 * way this file's Gemini/Supabase stubs let other route tests focus on the
 * one behaviour under test.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, type MockOptions } from './helpers/supabaseMock'

const createAdminClient = vi.fn()
const captureServerEvent = vi.fn()
const constructEvent = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createAdminClient: () => createAdminClient(),
}))
vi.mock('../lib/posthog/server', () => ({ captureServerEvent: (...a: unknown[]) => captureServerEvent(...a) }))
vi.mock('../lib/stripe/client', () => ({
  getStripeClient: () => ({ webhooks: { constructEvent: (...a: unknown[]) => constructEvent(...a) } }),
}))

const { POST } = await import('../app/api/stripe/webhook/route')

const DB_DOWN = { message: 'connection reset', code: '08006' }

function wire(tables: MockOptions['tables'] = {}) {
  const mock = createSupabaseMock({ tables: { profiles: { data: null, error: null }, ...tables } })
  createAdminClient.mockReturnValue(mock.client)
  return mock
}

function upsertPayload(mock: ReturnType<typeof createSupabaseMock>) {
  const write = mock.callsTo('subscriptions').find((c) => c.operation === 'upsert')
  return (write?.payload as { payload: Record<string, unknown> } | undefined)?.payload
}

function post(event: unknown) {
  constructEvent.mockReturnValue(event)
  return POST(
    new Request('http://localhost/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': 'sig_test' },
      body: JSON.stringify(event),
    })
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
})

describe('POST /api/stripe/webhook — subscription lifecycle', () => {
  it('upserts on checkout.session.completed and answers 200 — successful webhook', async () => {
    const mock = wire({ subscriptions: { upsert: { data: null, error: null } } })
    const res = await post({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          metadata: { user_id: 'user-1', plan: 'monthly' },
          customer: 'cus_1',
          subscription: 'sub_1',
        },
      },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ received: true })
    expect(upsertPayload(mock)).toMatchObject({ user_id: 'user-1', status: 'active', plan: 'monthly' })
    expect(captureServerEvent).toHaveBeenCalledWith('user-1', 'upgrade_completed', expect.anything())
  })

  it('cancels on customer.subscription.deleted — subscription deletion', async () => {
    const mock = wire({ subscriptions: { upsert: { data: null, error: null } } })
    const res = await post({
      type: 'customer.subscription.deleted',
      data: {
        object: { id: 'sub_1', status: 'canceled', customer: 'cus_1', metadata: { user_id: 'user-1' } },
      },
    })
    expect(res.status).toBe(200)
    expect(upsertPayload(mock)).toMatchObject({ user_id: 'user-1', status: 'canceled' })
    expect(captureServerEvent).toHaveBeenCalledWith('user-1', 'subscription_cancelled', { provider: 'stripe' })
  })

  it('marks past_due on invoice.payment_failed — payment failure', async () => {
    const mock = wire({ subscriptions: { update: { data: null, error: null } } })
    const res = await post({
      type: 'invoice.payment_failed',
      data: { object: { subscription: 'sub_1' } },
    })
    expect(res.status).toBe(200)
    const write = mock.callsTo('subscriptions').find((c) => c.operation === 'update')
    expect(write?.payload).toMatchObject({ status: 'past_due' })
    expect(write?.filters).toContainEqual(['eq', 'stripe_subscription_id', 'sub_1'])
  })

  /**
   * The behaviour this fix exists for: matches
   * webhookSignatures.test.ts's "500s on a failed write so Razorpay retries".
   * A 200 here would tell Stripe the event was handled and it would never
   * retry, leaving the row on its old (wrong) status forever.
   */
  it.each([
    [
      'checkout.session.completed',
      { type: 'checkout.session.completed', data: { object: { mode: 'subscription', metadata: { user_id: 'user-1' }, customer: 'cus_1', subscription: 'sub_1' } } },
      { subscriptions: { upsert: { data: null, error: DB_DOWN } } },
    ],
    [
      'customer.subscription.updated',
      { type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'active', customer: 'cus_1', metadata: { user_id: 'user-1' } } } },
      { subscriptions: { upsert: { data: null, error: DB_DOWN } } },
    ],
    [
      'invoice.payment_failed',
      { type: 'invoice.payment_failed', data: { object: { subscription: 'sub_1' } } },
      { subscriptions: { update: { data: null, error: DB_DOWN } } },
    ],
  ])('500s on a failed Supabase write for %s, instead of a misleading 200', async (_label, event, tables) => {
    wire(tables as MockOptions['tables'])
    const res = await post(event)
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toContain(DB_DOWN.message)
  })
})
