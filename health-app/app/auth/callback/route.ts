import { NextResponse } from 'next/server'
import { createServerClient } from '../../../lib/supabase/server'

/**
 * OAuth / Magic-link callback handler.
 * Supabase PKCE flow sends a `code` param here after Google (or any provider)
 * authenticates the user. We exchange it for a session, set the cookie, then
 * redirect to the dashboard (or wherever the user was headed).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = createServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Redirect to the intended destination (default: dashboard)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Something went wrong — send back to sign-in with an error hint
  return NextResponse.redirect(`${origin}/auth/sign-in?error=oauth_callback_failed`)
}
