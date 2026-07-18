'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBrowserSupabaseClient } from '../../lib/supabase/client'
import { captureEvent, identifyUser } from '../../lib/posthog/client'
import { EVENTS } from '../../lib/posthog/events'
import { toast } from '../ui/use-toast'

type Props = {
  children: React.ReactNode
  className?: string
  /** Where this button sits on the landing page — becomes the `placement`
   *  prop on `anon_session_started`, so we can see which CTA actually converts. */
  placement: 'header' | 'hero' | 'pricing' | 'footer_cta'
}

/**
 * Deferred signup entry point. Mints an anonymous Supabase session and drops
 * the user straight into onboarding — no email, no password, no inbox round
 * trip before they've seen the app do anything.
 *
 * The anonymous user is a real row in auth.users with a real auth.uid(), so
 * every RLS policy and every existing query works untouched; they convert
 * later via updateUser({ email, password }) on the *same* user id, which is
 * why there is no data migration or merge path anywhere in this feature.
 *
 * Falls back to the classic /auth/sign-up form on any failure. That matters
 * more than usual here: anonymous sign-in must be enabled in the Supabase
 * dashboard, so until that toggle is on this button fails on every click —
 * and the fallback means the funnel still works rather than dead-ending.
 */
export function StartFreeButton({ children, className, placement }: Props) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const start = async () => {
    if (loading) return
    setLoading(true)
    try {
      const supabase = getBrowserSupabaseClient()

      // `/` is a public route, so a signed-in user can land back here — an
      // anonymous one who reopened the PWA, or a registered one who tapped the
      // logo. Minting a second anonymous account for them would strand every
      // log they'd already written under the first, unreachable id. Reuse the
      // session instead; /onboarding forwards to /dashboard once the profile
      // is complete, so this lands both cases in the right place.
      const { data: existing } = await supabase.auth.getSession()
      if (existing.session) {
        router.push('/onboarding')
        return
      }

      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) throw new Error(error.message)

      if (data.user) {
        // person_profiles is 'identified_only', so without this the entire
        // pre-conversion funnel would be invisible in PostHog — which is the
        // part of the funnel this whole change exists to improve.
        identifyUser(data.user.id, { is_anonymous: true })
        captureEvent(EVENTS.ANON_SESSION_STARTED, { placement })
      }

      router.push('/onboarding')
    } catch {
      // Don't show an error — the user asked to get started, so get them
      // started. The email form is a slower path to the same place.
      toast({
        title: 'Continue with email',
        description: 'Set up your account to get started.',
      })
      router.push('/auth/sign-up')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button type="button" onClick={start} disabled={loading} className={className}>
      {loading ? 'Starting…' : children}
    </button>
  )
}
