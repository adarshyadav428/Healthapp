import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import {
  FIRST_TOUCH_COOKIE,
  FIRST_TOUCH_MAX_AGE_S,
  buildFirstTouch,
  serializeFirstTouch,
} from './lib/attribution'

// How long we'll wait for Supabase to revalidate the session before treating
// it as a network failure rather than an auth failure. On a healthy connection
// this resolves in well under a second; this is a ceiling, not a target.
const AUTH_TIMEOUT_MS = 5000

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const publicFiles = ['/sw.js', '/manifest.webmanifest', '/robots.txt', '/sitemap.xml', '/opengraph-image']
  const publicPrefixes = ['/icons/', '/.well-known/', '/workbox-', '/fallback-']

  if (
    publicFiles.includes(pathname) ||
    publicPrefixes.some(prefix => pathname.startsWith(prefix)) ||
    (pathname.startsWith('/google') && pathname.endsWith('.html'))
  ) {
    return NextResponse.next()
  }

  const isApiRoute = pathname.startsWith('/api/')
  const isNextInternal = pathname.startsWith('/_next/')

  // API routes and Next internals authenticate themselves (every route handler
  // already calls supabase.auth.getUser()) — running the same Auth-server
  // round trip here first was pure duplicate latency on every single API call,
  // which is the most frequent request type in the app (search-as-you-type,
  // every log action). Let them through untouched.
  if (isApiRoute || isNextInternal) return NextResponse.next()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) return NextResponse.next()

  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        // Auth cookie writes must never be cached by a CDN/reverse proxy —
        // otherwise one user's session could be served to a different user.
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  const { origin } = request.nextUrl
  const isAuthRoute = pathname.startsWith('/auth/')
  // /studio is the design-review route: static mock data only, noindex, no user data.
  // /foods/* is the public, indexable programmatic-SEO food pages (curated IFCT data only).
  // /contact, /refunds and /pricing must be reachable without a session: a
  // payment aggregator's reviewer verifies the merchant from the public site,
  // and a policy page behind a sign-in wall reads to them as "missing".
  const isPublic = pathname === '/' || pathname === '/privacy' || pathname === '/terms' || pathname === '/refunds' || pathname === '/contact' || pathname === '/pricing' || pathname === '/delete-account' || pathname === '/upgrade' || pathname === '/studio' || pathname.startsWith('/foods/')

  // getUser() re-validates the session against the Supabase Auth server over
  // the network — unlike getSession(), it can't be spoofed by a tampered
  // cookie, which is exactly why it's the right check here. But that also
  // means it can fail for reasons that have nothing to do with whether the
  // user is actually logged in: a slow or dropped connection on the user's
  // end. Without this distinction, a flaky network and an expired session
  // look identical and both force a logout — which is what "sometimes
  // nothing happens, have to sign in again" actually was.
  let user: { id: string } | null = null
  let networkFailure = false
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('auth check timed out')), AUTH_TIMEOUT_MS)
    )
    const { data, error } = await Promise.race([supabase.auth.getUser(), timeout])
    // A clean response (even an error one) means Supabase's Auth server was
    // reached and gave an authoritative answer — trust it.
    user = error ? null : data.user
  } catch {
    // Thrown = the network call itself failed (timeout, DNS, connection
    // reset) — Supabase never actually said "this session is invalid". Fail
    // open: let the request through rather than force a logout for a purely
    // local network hiccup. The destination page still authenticates via its
    // own session read, and every data query is still enforced by Postgres
    // RLS regardless — this only affects whether we redirect on a guess.
    networkFailure = true
  }

  // First-touch attribution — stamp `gis_attr` once and never overwrite it, so
  // a later visit through a different campaign can't rewrite where this visitor
  // originally came from. The client reads it at identify() time and sends it
  // to PostHog as $set_once person properties (see lib/attribution.ts).
  // Set here, after the Supabase client's setAll may have rebuilt `response`,
  // so the cookie survives to the return.
  if (!request.cookies.get(FIRST_TOUCH_COOKIE)) {
    const firstTouch = buildFirstTouch({
      searchParams: request.nextUrl.searchParams,
      referer: request.headers.get('referer'),
      pathname,
      selfHost: request.nextUrl.host || null,
    })
    if (firstTouch) {
      response.cookies.set(FIRST_TOUCH_COOKIE, serializeFirstTouch(firstTouch), {
        maxAge: FIRST_TOUCH_MAX_AGE_S,
        sameSite: 'lax',
        secure: true,
        path: '/',
        httpOnly: false,
      })
    }
  }

  if (!user) {
    if (networkFailure) return response
    // Genuinely unauthenticated: allow public pages and auth routes, redirect everything else
    if (isPublic || isAuthRoute) return response
    const signInUrl = new URL('/auth/sign-in', origin)
    signInUrl.searchParams.set('returnTo', pathname)
    return NextResponse.redirect(signInUrl)
  }

  // Authenticated user on auth pages → redirect to dashboard
  if (isAuthRoute) {
    return NextResponse.redirect(new URL('/dashboard', origin))
  }

  // Onboarding completeness is checked by every protected page itself (it
  // already needs the profile row for its own data), so this used to be a
  // second, fully redundant profiles query on every single navigation.

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw\\.js|workbox-.*|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|opengraph-image|icons/.*|\\.well-known/.*).*)',],
}
