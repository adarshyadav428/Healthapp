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
        captureServerEvent(user.id, 'signup_completed', { method: 'google' })
      }

      // Reaching this point means the user followed a link that was delivered
      // to their address — a verification magic link, a signup confirmation, or
      // a Google sign-in where Google has already vouched for the address. All
      // three are proof of ownership, which is exactly what
      // profiles.email_verified_at records.
      //
      // We can't use auth.users.email_confirmed_at for this: with "Confirm
      // email" switched off, Supabase auto-stamps it at signup, so it says
      // nothing about whether the address is real. See migration 027.
      if (user) {
        const { error: verifyError } = await supabase
          .from('profiles')
          .update({ email_verified_at: new Date().toISOString() })
          .eq('id', user.id)
          .is('email_verified_at', null)

        // Non-fatal: the user is legitimately signed in either way, and the
        // nudge reappearing is a far better failure than blocking the redirect.
        if (!verifyError) {
          captureServerEvent(user.id, 'email_verified', {})
        }
      }

      // Redirect to the intended destination (default: dashboard)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Something went wrong — send back to sign-in with an error hint
  return NextResponse.redirect(`${origin}/auth/sign-in?error=oauth_callback_failed`)
}
