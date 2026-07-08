import { NextResponse } from 'next/server'
import { createServerClient } from '../../../lib/supabase/server'
import { captureServerEvent } from '../../../lib/posthog/server'

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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Heuristic for "just signed up via OAuth" vs. a returning sign-in:
      // account created within the last minute of this callback firing.
      const user = data.user
      if (user && Date.now() - new Date(user.created_at).getTime() < 60_000) {
        captureServerEvent(user.id, 'user_signed_up', { method: 'google' })
      }
      // Redirect to the intended destination (default: dashboard)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Something went wrong — send back to sign-in with an error hint
  return NextResponse.redirect(`${origin}/auth/sign-in?error=oauth_callback_failed`)
}
