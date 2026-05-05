import { cookies } from 'next/headers'
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
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
 * Create an admin Supabase client using the service role key. Only use this on trusted server routes
 * such as webhook handlers.
 */
export function createAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !serviceRole) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceRole)
}
