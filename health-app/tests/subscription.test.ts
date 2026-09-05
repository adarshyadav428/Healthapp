import { describe, it, expect } from 'vitest'
import { getIsPro, getSubscription, isProStatus, SubscriptionReadError } from '../lib/subscription'

describe('isProStatus', () => {
  it('treats active and trialing as Pro', () => {
    expect(isProStatus('active')).toBe(true)
    expect(isProStatus('trialing')).toBe(true)
  })

  it('treats every other status as free', () => {
    expect(isProStatus('canceled')).toBe(false)
    expect(isProStatus('past_due')).toBe(false)
    expect(isProStatus('')).toBe(false)
    expect(isProStatus('ACTIVE')).toBe(false) // status vocab is lowercase
  })

  it('handles missing subscription rows', () => {
    expect(isProStatus(null)).toBe(false)
    expect(isProStatus(undefined)).toBe(false)
  })
})

/**
 * 2026-09-05 adversarial-audit F2. getIsPro used to drop the read's `error`
 * entirely (`const { data } = await …`), so a failed read and "genuinely no
 * subscription row" were indistinguishable — both resolved to `false`. That
 * silently punished a real Pro user with the free tier every time this read
 * blipped, across ~10 call sites. It must now throw instead, so every caller
 * decides explicitly what a person sees rather than a DB blip deciding it
 * for them.
 */
describe('getIsPro', () => {
  function supabaseWith(result: { data: unknown; error: unknown }) {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve(result),
          }),
        }),
      }),
    } as never
  }

  it('resolves true for an active subscription', async () => {
    const sb = supabaseWith({ data: { status: 'active' }, error: null })
    expect(await getIsPro(sb, 'user-1')).toBe(true)
  })

  it('resolves false for no subscription row (genuinely free)', async () => {
    const sb = supabaseWith({ data: null, error: null })
    expect(await getIsPro(sb, 'user-1')).toBe(false)
  })

  it('throws SubscriptionReadError on a failed read — never silently false', async () => {
    const sb = supabaseWith({ data: null, error: { message: 'connection reset' } })
    await expect(getIsPro(sb, 'user-1')).rejects.toBeInstanceOf(SubscriptionReadError)
  })

  it('SubscriptionReadError carries a message safe to show a user (no internals)', () => {
    const err = new SubscriptionReadError()
    expect(err.message).not.toMatch(/postgres|connection|relation|column/i)
  })
})

/**
 * 2026-09-05 adversarial-audit F2 follow-up. app/welcome, app/progress and
 * app/weight (Server Components) had the exact same swallowed-error shape as
 * the ~10 API routes F2 originally fixed — but a page.tsx can't be imported
 * by this test suite at all (tsconfig's jsx:"preserve", required for Next's
 * own build, makes Vitest's SSR loader refuse to parse any .tsx file; every
 * existing test in this repo imports only from lib/ or app/api/, never
 * app/**\/page.tsx, for exactly this reason). So instead of leaving the fix
 * unpinned, all three pages were routed through getIsPro()/getSubscription()
 * — these tests are the actual regression coverage for that fix; the pages
 * themselves are now thin enough that calling them correctly is the whole
 * remaining risk, and that can only be confirmed by code review, not a test.
 */
describe('getSubscription', () => {
  function supabaseWith(result: { data: unknown; error: unknown }) {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve(result),
          }),
        }),
      }),
    } as never
  }

  it('resolves the full row (status, plan, provider) for an active subscription', async () => {
    const sb = supabaseWith({ data: { status: 'active', plan: 'monthly', provider: 'razorpay' }, error: null })
    expect(await getSubscription(sb, 'user-1')).toEqual({ status: 'active', plan: 'monthly', provider: 'razorpay' })
  })

  it('resolves null for no subscription row (genuinely free)', async () => {
    const sb = supabaseWith({ data: null, error: null })
    expect(await getSubscription(sb, 'user-1')).toBeNull()
  })

  it('throws SubscriptionReadError on a failed read — never silently null', async () => {
    const sb = supabaseWith({ data: null, error: { message: 'connection reset' } })
    await expect(getSubscription(sb, 'user-1')).rejects.toBeInstanceOf(SubscriptionReadError)
  })
})
