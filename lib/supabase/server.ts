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
      // getAll is required so @supabase/ssr can reassemble chunked session cookies
      // (large JWTs are split across multiple cookies: sb-xxx-auth-token.0, .1, ...)
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component — safe to ignore.
          // Middleware handles session refresh and cookie writing.
        }
      },
    },
  })
}

/**
 * Create an admin Supabase client using the service role key. Only use this on trusted server routes
 * such as webhook handlers.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceRole)
}
