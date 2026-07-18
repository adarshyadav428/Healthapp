'use client'

import { useState } from 'react'
import { getBrowserSupabaseClient } from '../lib/supabase/client'
import { captureEvent } from '../lib/posthog/client'
import { toast } from '../components/ui/use-toast'

/**
 * Sends a one-time link to the address on file to prove the user owns it.
 *
 * Shared by the dashboard nudge card and the checkout gate — both need the
 * identical flow, and having one copy means the two can't drift into sending
 * subtly different links.
 *
 * Clicking the link lands on /auth/callback, which is what actually stamps
 * profiles.email_verified_at. Nothing here marks the user verified; sending is
 * not proof, arriving is.
 */
export function useSendVerificationLink(email: string | undefined) {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const send = async (source: string) => {
    if (sending || !email) return
    setSending(true)
    try {
      const supabase = getBrowserSupabaseClient()
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          // They already have an account — this link proves the address, it
          // must never quietly create a second one.
          shouldCreateUser: false,
          emailRedirectTo: `${appUrl}/auth/callback?next=/dashboard`,
        },
      })
      if (error) throw new Error(error.message)

      captureEvent('email_verification_sent', { source })
      setSent(true)
      toast({
        title: 'Link sent',
        description: `Tap the link we sent to ${email} to confirm it's yours.`,
      })
    } catch (err) {
      toast({
        title: "Couldn't send the link",
        description: (err as Error).message,
        variant: 'error',
      })
    } finally {
      setSending(false)
    }
  }

  return { send, sending, sent }
}
