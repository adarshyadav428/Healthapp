import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies'

/**
 * Create a Supabase client for server-side usage tied to the incoming request's cookies.
 * Use this in server components / route handlers to act on behalf of the current user.
 *
 * IMPORTANT: @supabase/ssr@0.2.0 internally calls cookies.get(name) to reassemble
 * chunked session cookies. Providing only getAll/setAll means .get is undefined and
 * getSession() always returns null. We must use the get/set/remove API.
 */
export function createServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) throw new Error('Missing Supabase server environment variables')

  const cookieStore = cookies()
  return createSupabaseServerClient(url, anonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: Omit<ResponseCookie, 'name' | 'value'>) {
        try {
          cookieStore.set(name, value, options)
        } catch {
          // Called from a Server Component — cookies() is read-only here.
          // Middleware handles session refresh and cookie writing.
        }
      },
      remove(name: string, options: Omit<ResponseCookie, 'name' | 'value'>) {
        try {
          cookieStore.set(name, '', { ...options, maxAge: 0 })
        } catch {
          // Called from a Server Component — cookies() is read-only here.
        }
      },
    },
  })
}

/**
 * Get the current user in a Server Component/page, redirecting to sign-in if there
 * isn't one. Uses getSession() (local cookie decode, no network round trip) rather
 * than getUser() (which re-validates against the Supabase Auth server every time) —
 * middleware.ts already did that network revalidation for this exact request one hop
 * earlier and would have redirected already if it failed. Calling getUser() again
 * here was pure duplicate latency: every page paid for two Auth-server round trips
 * instead of one. This is safe because the actual data access is still enforced by
 * Postgres RLS regardless of what this function returns.
 */
export async function getAuthedUser(supabase: SupabaseClient): Promise<User> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect('/auth/sign-in')
  return session.user
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
