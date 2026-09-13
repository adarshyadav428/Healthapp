/**
 * Middleware redirects.
 *
 * This is the app's front door: it decides, for every navigation, whether a
 * request reaches a page or bounces to sign-in.
 *
 * Two properties here are load-bearing and easy to break by accident:
 *
 *   1. It verifies the session LOCALLY, via getClaims() (JWT signature +
 *      expiry, checked against the project's public JWKS) rather than a
 *      network round trip to the Auth server. That trade only works because
 *      a page render is not the security boundary — Postgres RLS is, on
 *      every actual data query the destination page or its API calls make.
 *   2. It does not touch auth at all for /api/* or /_next/*. Every route handler
 *      already authenticates, so doing it here too was a duplicate check on
 *      the most frequent request type in the app.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const getClaims = vi.fn()
const createServerClient = vi.fn(() => ({ auth: { getClaims: (...a: unknown[]) => getClaims(...a) } }))

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => createServerClient(...(args as [])),
}))

const { middleware } = await import('../middleware')

const ORIGIN = 'https://getinshape.co.in'

function request(pathname: string) {
  return new NextRequest(new URL(pathname, ORIGIN))
}

function signedIn() {
  getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1' } }, error: null })
}

function signedOut() {
  // An authoritative "no valid session" — a missing, expired or bad-signature token.
  getClaims.mockResolvedValue({ data: { claims: null }, error: { message: 'invalid JWT' } })
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
    '/opengraph-image',
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
      // Route handlers authenticate themselves; doing it here too was a
      // duplicate check on every search keystroke.
      expect(getClaims).not.toHaveBeenCalled()
    }
  )

  it('does not re-authenticate Next internals', async () => {
    await middleware(request('/_next/webpack-hmr'))
    expect(getClaims).not.toHaveBeenCalled()
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

  /** A rejected claims check IS an answer: the token is missing, expired or invalid. */
  it('treats an authoritative auth error as signed out', async () => {
    getClaims.mockResolvedValue({ data: { claims: null }, error: { message: 'token expired' } })
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
