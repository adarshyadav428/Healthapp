/**
 * /api/account/delete — F1 (2026-09-05 adversarial-audit fix).
 *
 * The route's whole job is "cancel first, then delete" so a deleted web
 * subscriber isn't billed forever with no way to stop (see the route's own
 * top comment). Before this fix, the subscription-status read dropped its
 * `error`: a transient read failure made `sub` come back `undefined`, which
 * skipped the cancel-or-block branch entirely and let the account be deleted
 * with an active subscription still live at the provider — a false success,
 * and a billing relationship silently abandoned.
 *
 * These tests pin the full corrected sequence: a failed read must abort
 * before any deletion; a failed provider cancel must abort (unchanged,
 * already-correct behaviour); a successful cancel must be persisted locally
 * *before* deleteUser() runs, so that if deleteUser() then fails, a retry
 * sees the subscription already 'canceled' and skips re-cancelling (which
 * would otherwise error against an already-cancelled provider subscription).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSupabaseMock, type MockOptions } from './helpers/supabaseMock'

const createServerClient = vi.fn()
const createAdminClient = vi.fn()

vi.mock('../lib/supabase/server', () => ({
  createServerClient: () => createServerClient(),
  createAdminClient: () => createAdminClient(),
}))

const razorpayCancel = vi.fn()
const stripeCancel = vi.fn()
vi.mock('../lib/razorpay/client', () => ({
  getRazorpayClient: () => ({ subscriptions: { cancel: razorpayCancel } }),
}))
vi.mock('../lib/stripe/client', () => ({
  getStripeClient: () => ({ subscriptions: { cancel: stripeCancel } }),
}))

const { POST } = await import('../app/api/account/delete/route')

function wire(options: {
  user?: MockOptions['user']
  tables?: MockOptions['tables']
  deleteUserError?: { message: string } | null
} = {}) {
  const server = createSupabaseMock({
    user: options.user === undefined ? { id: 'user-1', email: 'a@b.com' } : options.user,
  })
  const admin = createSupabaseMock({ tables: options.tables })
  admin.client.auth.admin = {
    deleteUser: vi.fn().mockResolvedValue({ error: options.deleteUserError ?? null }),
  }
  createServerClient.mockReturnValue(server.client)
  createAdminClient.mockReturnValue(admin.client)
  return { server, admin }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/account/delete', () => {
  it('401s when there is no authenticated user', async () => {
    wire({ user: null })
    const res = await POST()
    expect(res.status).toBe(401)
  })

  it('aborts without deleting when the subscription read fails — never treats an unreadable subscription as "none"', async () => {
    const { admin } = wire({
      tables: { subscriptions: { select: { data: null, error: { message: 'connection reset' } } } },
    })
    const res = await POST()
    expect(res.status).toBe(500)
    expect(admin.client.auth.admin.deleteUser).not.toHaveBeenCalled()
    expect(razorpayCancel).not.toHaveBeenCalled()
  })

  it('deletes directly when there is no subscription row at all', async () => {
    const { admin } = wire({ tables: { subscriptions: { select: { data: null, error: null } } } })
    const res = await POST()
    expect(res.status).toBe(200)
    expect(admin.client.auth.admin.deleteUser).toHaveBeenCalledWith('user-1')
  })

  it('blocks deletion for an active Google Play subscription without attempting any cancel', async () => {
    const { admin } = wire({
      tables: {
        subscriptions: { select: { data: { provider: 'google_play', status: 'active' }, error: null } },
      },
    })
    const res = await POST()
    expect(res.status).toBe(409)
    expect(admin.client.auth.admin.deleteUser).not.toHaveBeenCalled()
    expect(razorpayCancel).not.toHaveBeenCalled()
  })

  it('cancels an active Razorpay subscription, persists it, then deletes', async () => {
    razorpayCancel.mockResolvedValue({})
    const { admin } = wire({
      tables: {
        subscriptions: {
          select: {
            data: { provider: 'razorpay', status: 'active', razorpay_subscription_id: 'sub_123' },
            error: null,
          },
          update: { data: null, error: null },
        },
      },
    })
    const res = await POST()
    expect(res.status).toBe(200)
    expect(razorpayCancel).toHaveBeenCalledWith('sub_123', false)
    const updateCall = admin.callsTo('subscriptions').find((c) => c.operation === 'update')
    expect(updateCall?.payload).toEqual({ status: 'canceled' })
    expect(admin.client.auth.admin.deleteUser).toHaveBeenCalled()
  })

  it('aborts with 502 and never touches the local row when the provider cancel call fails', async () => {
    razorpayCancel.mockRejectedValue(new Error('Razorpay is down'))
    const { admin } = wire({
      tables: {
        subscriptions: {
          select: {
            data: { provider: 'razorpay', status: 'active', razorpay_subscription_id: 'sub_123' },
            error: null,
          },
        },
      },
    })
    const res = await POST()
    expect(res.status).toBe(502)
    expect(admin.callsTo('subscriptions').some((c) => c.operation === 'update')).toBe(false)
    expect(admin.client.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  it('aborts with 500 and never deletes when the provider cancel succeeds but persisting it locally fails', async () => {
    razorpayCancel.mockResolvedValue({})
    const { admin } = wire({
      tables: {
        subscriptions: {
          select: {
            data: { provider: 'razorpay', status: 'active', razorpay_subscription_id: 'sub_123' },
            error: null,
          },
          update: { data: null, error: { message: 'write timed out' } },
        },
      },
    })
    const res = await POST()
    expect(res.status).toBe(500)
    // The provider cancel DID succeed — this is the exact "cancelled
    // externally but local write failed" case. The account must not be
    // deleted while we can't prove that's recorded.
    expect(razorpayCancel).toHaveBeenCalled()
    expect(admin.client.auth.admin.deleteUser).not.toHaveBeenCalled()
  })

  it('a retry after a successful cancel + failed deleteUser skips re-cancelling and just deletes', async () => {
    // Simulates the account already having status: 'canceled' from a prior
    // run whose deleteUser() failed. ACTIVE.has('canceled') is false, so the
    // whole cancel-or-block branch is skipped this time.
    const { admin } = wire({
      tables: {
        subscriptions: {
          select: {
            data: { provider: 'razorpay', status: 'canceled', razorpay_subscription_id: 'sub_123' },
            error: null,
          },
        },
      },
    })
    const res = await POST()
    expect(res.status).toBe(200)
    expect(razorpayCancel).not.toHaveBeenCalled()
    expect(admin.client.auth.admin.deleteUser).toHaveBeenCalledWith('user-1')
  })

  it('cancels an active Stripe subscription, persists it, then deletes', async () => {
    stripeCancel.mockResolvedValue({})
    const { admin } = wire({
      tables: {
        subscriptions: {
          select: {
            data: { provider: 'stripe', status: 'trialing', stripe_subscription_id: 'sub_abc' },
            error: null,
          },
          update: { data: null, error: null },
        },
      },
    })
    const res = await POST()
    expect(res.status).toBe(200)
    expect(stripeCancel).toHaveBeenCalledWith('sub_abc')
    const updateCall = admin.callsTo('subscriptions').find((c) => c.operation === 'update')
    expect(updateCall?.payload).toEqual({ status: 'canceled' })
  })

  it('returns 500 without leaking the raw deleteUser error when deletion itself fails', async () => {
    razorpayCancel.mockResolvedValue({})
    wire({
      tables: {
        subscriptions: {
          select: { data: null, error: null },
        },
      },
      deleteUserError: { message: 'internal supabase admin api 500: connection pool exhausted' },
    })
    const res = await POST()
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).not.toContain('connection pool')
  })
})
