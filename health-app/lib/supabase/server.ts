import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Create a Supabase client for server-side usage tied to the incoming request's cookies.
 * Use this in server components / route handlers to act on behalf of the current user.
 */
export function createServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Missing Supabase server environment variables')

  const cookieStore = cookies()
  return createSupabaseServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Called from a Server Component — cookies() is read-only here.
          // Middleware handles session refresh and cookie writing.
        }
      },
    },
  })
}

export type AuthedUser = { id: string; email: string | null }

/**
 * Get the current user in a Server Component/page, redirecting to sign-in if there
 * isn't one. Uses getClaims() — which verifies the JWT's signature locally via
 * WebCrypto (this project uses ES256 asymmetric signing keys, confirmed against
 * its public JWKS endpoint) rather than getUser(), which always re-validates
 * against the Supabase Auth server over the network. middleware.ts already did
 * that authoritative network revalidation for this exact request one hop earlier
 * and would have redirected already if it failed; calling getUser() again here
 * was pure duplicate latency. getClaims() only checks the token's signature and
 * expiry, not live server-side revocation — that's fine here because middleware
 * is the real gate for that, and every actual data query is still enforced by
 * Postgres RLS regardless of what this function returns.
 */
export async function getAuthedUser(supabase: SupabaseClient): Promise<AuthedUser> {
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) redirect('/auth/sign-in')
  return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? null }
}

/**
 * Get the current user in an API route handler, or null if unauthenticated.
 * Same local JWT verification as getAuthedUser() (see rationale above) — the
 * hot API paths (search-as-you-type, every log action) were paying a full
 * Supabase Auth-server round trip per request via getUser(), which added
 * ~100-300ms of latency to every interaction. Postgres RLS remains the real
 * enforcement layer for all data access. Billing and account-deletion routes
 * intentionally keep getUser() — for rare, sensitive actions the authoritative
 * revocation check is worth the extra hop.
 */
export async function getApiUser(supabase: SupabaseClient): Promise<AuthedUser | null> {
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) return null
  return { id: data.claims.sub, email: (data.claims.email as string | undefined) ?? null }
}

/**
 * Whether createAdminClient() can be constructed at all — i.e. whether both of
 * its env vars are present.
 *
 * Two call sites run at BUILD time, outside any request: generateStaticParams
 * in app/foods/[slug]/page.tsx and getFoodPageUrls in app/sitemap.ts. Both
 * would throw here and fail `next build` outright when the vars are unset,
 * which is exactly the state CI runs in: this repository is public, and the
 * service-role key bypasses RLS on the production database, so it must never
 * be held in GitHub Actions secrets. Those two call sites check this first and
 * degrade to an empty list, which is what lets `npm run build` be a CI gate
 * with no secrets at all. On Vercel the vars are always set, so neither guard
 * is ever taken in production.
 *
 * Deliberately narrow: this reports only that the vars are ABSENT. A reachable
 * Supabase that errors, or a network failure mid-build, must keep failing the
 * deploy loudly rather than silently shipping a site with no food pages — so
 * neither call site wraps its query in try/catch.
 */
export function hasAdminEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  )
}

/**
 * Create an admin Supabase client using the service role key. Only use this on trusted server routes
 * such as webhook handlers.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceRole) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceRole)
}
