/**
 * Middleware redirects.
 *
 * This is the app's front door: it decides, for every navigation, whether a
 * request reaches a page or bounces to sign-in. It had no test, and it has
 * already been the site of a user-visible bug — "sometimes nothing happens,
 * have to sign in again" was a flaky network being treated as an expired
 * session, because a thrown auth call and an invalid one looked identical.
 *
 * Three properties here are load-bearing and easy to break by accident:
 *
 *   1. It FAILS OPEN on a network failure. Supabase never said the session was
 *      invalid, so guessing "logged out" is a logout nobody asked for. Safe
 *      because the destination page authenticates itself and RLS enforces every
 *      query regardless — the middleware only decides whether to redirect.
 *   2. It FAILS CLOSED on an authoritative rejection. An error response from
 *      the Auth server IS an answer, and it means no session.
 *   3. It does not touch auth at all for /api/* or /_next/*. Every route handler
 *      already authenticates, so doing it here too was a duplicate Auth-server
 *      round trip on the most frequent request type in the app.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getUser = vi.fn()
const createServerClient = vi.fn(() => ({ auth: { getUser: (...a: unknown[]) => getUser(...a) } }))

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => createServerClient(...(args as [])),
}))

const { middleware } = await import('../middleware')

const ORIGIN = 'https://getinshape.co.in'
const AUTH_TIMEOUT_MS = 5000

function request(pathname: string) {
  return new NextRequest(new URL(pathname, ORIGIN))
}

function signedIn() {
  getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
}

function signedOut() {
  // An authoritative "no session" from the Auth server.
  getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } })
}

/** The Location header of a redirect, or null when the request passed through. */
function redirectTo(response: Response): string | null {
  if (response.status < 300 || response.status >= 400) return null
  return response.headers.get('location')
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
  signedOut()
})

describe('paths that skip auth entirely', () => {
  it.each([
    '/sw.js',
    '/manifest.webmanifest',
    '/robots.txt',
    '/sitemap.xml',
    '/icons/icon-192.png',
    '/.well-known/assetlinks.json',
    '/workbox-abc123.js',
    '/fallback-development.js',
    '/google1234abcd.html',
  ])('passes %s through without an auth call', async (path) => {
    const res = await middleware(request(path))
    expect(redirectTo(res)).toBeNull()
    expect(createServerClient).not.toHaveBeenCalled()
  })

  /**
   * The TWA's Digital Asset Links file is what makes the installed Android app
   * open without a browser chrome. A redirect here silently breaks verification.
   */
  it('serves /.well-known/assetlinks.json even signed out', async () => {
    const res = await middleware(request('/.well-known/assetlinks.json'))
    expect(res.status).toBe(200)
  })

  it.each(['/api/logs', '/api/foods/search', '/api/play/rtdn'])(
    'does not re-authenticate %s',
    async (path) => {
      const res = await middleware(request(path))
      expect(redirectTo(res)).toBeNull()
      // Route handlers authenticate themselves; doing it here too was a full
      // Auth-server round trip on every search keystroke.
      expect(getUser).not.toHaveBeenCalled()
    }
  )

  it('does not re-authenticate Next internals', async () => {
    await middleware(request('/_next/webpack-hmr'))
    expect(getUser).not.toHaveBeenCalled()
  })

  /**
   * NextRequest rewrites a data URL to the page it belongs to, so
   * /_next/data/<build>/dashboard.json arrives here as /dashboard. It is
   * therefore NOT treated as an internal — and should not be: a data request
   * for a protected page deserves the same answer the page would get.
   */
  it('treats a data request for a protected page as that page', async () => {
    const res = await middleware(request('/_next/data/build/dashboard.json'))
    expect(redirectTo(res)).toContain('/auth/sign-in')
  })

  it('passes everything through when Supabase is not configured', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    const res = await middleware(request('/dashboard'))
    expect(redirectTo(res)).toBeNull()
  })
})

describe('unauthenticated requests', () => {
  it.each([
    '/dashboard',
    '/log',
    '/weight',
    '/settings',
    '/progress',
    '/onboarding',
    '/welcome',
    '/wrapped',
  ])('redirects %s to sign-in', async (path) => {
    const location = redirectTo(await middleware(request(path)))
    expect(location).toBe(`${ORIGIN}/auth/sign-in?returnTo=${encodeURIComponent(path)}`)
  })

  it('remembers a deep link so sign-in can return the user to it', async () => {
    const location = redirectTo(await middleware(request('/log/history')))
    expect(new URL(location!).searchParams.get('returnTo')).toBe('/log/history')
  })

  /**
   * The public prefix covers the whole subtree, not just the top page. The SEO
   * food pages are the app's indexable surface — a crawler that gets bounced to
   * sign-in de-indexes them.
   */
  it('serves every path under /foods/ without a session', async () => {
    for (const path of ['/foods/poha', '/foods/cooked-rice-chawal', '/foods/a/b/c']) {
      expect(redirectTo(await middleware(request(path))), path).toBeNull()
    }
  })

  it.each([
    ['/', 'the landing page'],
    ['/privacy', 'a Play-required policy page'],
    ['/terms', 'a Play-required policy page'],
    ['/refunds', 'a payment-aggregator-required policy page'],
    ['/contact', 'the merchant contact details a payment aggregator verifies'],
    ['/pricing', 'public pricing, which a payment aggregator verifies'],
    ['/delete-account', 'the standalone URL Play’s Data-safety form requires'],
    ['/upgrade', 'the paywall, which must be readable before signing up'],
    ['/studio', 'the design reference — mock data only, noindex'],
    ['/foods/cooked-rice-chawal', 'a public programmatic-SEO food page'],
  ])('serves %s without a session (%s)', async (path) => {
    expect(redirectTo(await middleware(request(path)))).toBeNull()
  })

  it.each(['/auth/sign-in', '/auth/sign-up', '/auth/callback'])(
    'serves %s without a session',
    async (path) => {
      expect(redirectTo(await middleware(request(path)))).toBeNull()
    }
  )

  /** An error response IS an answer: the Auth server was reached and said no. */
  it('treats an authoritative auth error as signed out', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: 'token expired' } })
    expect(redirectTo(await middleware(request('/dashboard')))).toContain('/auth/sign-in')
  })
})

describe('authenticated requests', () => {
  beforeEach(signedIn)

  it.each(['/dashboard', '/log', '/settings', '/foods/cooked-rice-chawal'])(
    'serves %s',
    async (path) => {
      expect(redirectTo(await middleware(request(path)))).toBeNull()
    }
  )

  it.each(['/auth/sign-in', '/auth/sign-up'])('sends %s to the dashboard', async (path) => {
    expect(redirectTo(await middleware(request(path)))).toBe(`${ORIGIN}/dashboard`)
  })

  it('does not query the profile on every navigation', async () => {
    // Onboarding completeness is checked by each protected page, which already
    // needs the profile row — doing it here was a second query per navigation.
    const client = createServerClient.mock.results
    await middleware(request('/dashboard'))
    expect(client.every((r) => !(r.value as any).from)).toBe(true)
  })
})

/**
 * The bug this section exists for. A thrown auth call means the network failed,
 * NOT that the session is invalid — Supabase never gave an answer. Redirecting
 * on that guess logs people out for a dropped packet.
 */
describe('network failure fails open', () => {
  it.each([
    ['a connection reset', () => getUser.mockRejectedValue(new Error('ECONNRESET'))],
    ['a DNS failure', () => getUser.mockRejectedValue(new Error('EAI_AGAIN'))],
  ])('serves a protected page through %s', async (_label, arrange) => {
    arrange()
    expect(redirectTo(await middleware(request('/dashboard')))).toBeNull()
  })

  it('serves a protected page when the auth check times out', async () => {
    vi.useFakeTimers()
    try {
      // Never settles — the timeout is the only thing that can resolve this.
      getUser.mockReturnValue(new Promise(() => {}))

      const pending = middleware(request('/dashboard'))
      await vi.advanceTimersByTimeAsync(AUTH_TIMEOUT_MS + 1)

      expect(redirectTo(await pending)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not send a signed-out user to the dashboard on a network failure', async () => {
    // Failing open means "do not redirect", not "assume authenticated" — the
    // page still authenticates itself and RLS still governs every query.
    getUser.mockRejectedValue(new Error('ECONNRESET'))
    expect(redirectTo(await middleware(request('/auth/sign-in')))).toBeNull()
  })
})

describe('first-touch attribution', () => {
  const COOKIE = 'gis_attr'

  function req(path: string, init?: { referer?: string; cookie?: string }) {
    const headers = new Headers()
    if (init?.referer) headers.set('referer', init.referer)
    if (init?.cookie) headers.set('cookie', init.cookie)
    return new NextRequest(new URL(path, ORIGIN), { headers })
  }
  const attr = (res: Response) => {
    const raw = (res as unknown as { cookies: { get(n: string): { value: string } | undefined } }).cookies.get(COOKIE)
    return raw ? JSON.parse(raw.value) : null
  }

  beforeEach(() => signedIn())

  it('stamps gis_attr on a campaign landing', async () => {
    const res = await middleware(req('/?utm_source=insta&utm_campaign=launch'))
    expect(attr(res)).toMatchObject({ utm_source: 'insta', utm_campaign: 'launch', landing_path: '/' })
  })

  it('stamps a /foods/* SEO landing with no params', async () => {
    expect(attr(await middleware(req('/foods/poha')))?.landing_path).toBe('/foods/poha')
  })

  it('does not stamp a bare internal visit with no signal', async () => {
    expect(attr(await middleware(req('/dashboard')))).toBeNull()
  })

  it('never overwrites an existing gis_attr', async () => {
    const res = await middleware(
      req('/?utm_source=new', { cookie: `${COOKIE}=${encodeURIComponent('{"utm_source":"old"}')}` }),
    )
    // No Set-Cookie for gis_attr at all when it is already present.
    expect(attr(res)).toBeNull()
  })

  it('does not run for /api/* paths', async () => {
    expect(attr(await middleware(req('/api/logs?utm_source=x')))).toBeNull()
  })
})
