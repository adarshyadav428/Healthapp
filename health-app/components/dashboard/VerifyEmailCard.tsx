'use client'

import { useEffect, useState } from 'react'
import { MailCheck } from 'lucide-react'
import { useUser } from '../../hooks/useUser'
import { getBrowserSupabaseClient } from '../../lib/supabase/client'
import {
  parseVerifyPromptState,
  shouldPromptEmailVerification,
} from '../../lib/emailVerification'
import { captureEvent } from '../../lib/posthog/client'
import { toast } from '../ui/use-toast'

const storageKey = (uid: string) => `gis.verifyEmail.${uid}`

function persist(uid: string, patch: { lastDismissedAt?: string }) {
  try {
    const prev = parseVerifyPromptState(localStorage.getItem(storageKey(uid)))
    localStorage.setItem(storageKey(uid), JSON.stringify({ ...prev, ...patch }))
  } catch {
    /* noop — worst case we ask again */
  }
}

/**
 * "Confirm your email" card.
 *
 * Signup deliberately no longer blocks on an inbox round trip, which means an
 * address can be a typo and nobody would know. That costs the user their
 * password reset and costs us every reminder, weekly recap and receipt we try
 * to send. So we ask for proof later, once they've had a few days to decide
 * the app is worth keeping — decision logic in lib/emailVerification.ts.
 *
 * "Proof" is a magic link sent to the address: clicking it lands on
 * /auth/callback, which stamps profiles.email_verified_at. We can't rely on
 * auth.users.email_confirmed_at, because Supabase auto-stamps that at signup
 * once "Confirm email" is off (see migration 027).
 */
export function VerifyEmailCard() {
  const { user, profile } = useUser()
  const [visible, setVisible] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!user?.id || !profile) return
    let state = null
    try {
      state = parseVerifyPromptState(localStorage.getItem(storageKey(user.id)))
    } catch {
      /* fail open */
    }
    setVisible(
      shouldPromptEmailVerification({
        emailVerifiedAt: profile.email_verified_at ?? null,
        accountCreatedAt: profile.created_at ?? null,
        state,
      })
    )
  }, [user?.id, profile])

  if (!visible || !user?.id || !user.email) return null

  const sendLink = async () => {
    if (sending) return
    setSending(true)
    try {
      const supabase = getBrowserSupabaseClient()
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
      const { error } = await supabase.auth.signInWithOtp({
        email: user.email,
        options: {
          // They already have an account — this link proves the address, it
          // must never quietly create a second one.
          shouldCreateUser: false,
          emailRedirectTo: `${appUrl}/auth/callback?next=/dashboard`,
        },
      })
      if (error) throw new Error(error.message)

      captureEvent('email_verification_sent')
      setSent(true)
      toast({
        title: 'Link sent',
        description: `Tap the link we sent to ${user.email} to confirm it's yours.`,
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

  return (
    <div className="mt-4 rounded-[20px] bg-surface p-4" style={{ boxShadow: 'var(--shadow-air)' }}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <MailCheck size={18} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold text-ink">Confirm your email</p>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
            {sent ? (
              <>Check {user.email} and tap the link. It may take a minute to arrive.</>
            ) : (
              <>
                We&apos;ll send a link to <span className="font-medium text-ink">{user.email}</span>.
                Without it you can&apos;t reset your password if you forget it.
              </>
            )}
          </p>
        </div>
      </div>
      <div className="mt-3.5 flex gap-2.5">
        <button
          type="button"
          onClick={sendLink}
          disabled={sending}
          className="tap-scale flex h-10 flex-1 items-center justify-center rounded-control bg-brand-soft text-sm font-semibold text-brand-ink disabled:opacity-60"
        >
          {sending ? 'Sending…' : sent ? 'Resend link' : 'Send link'}
        </button>
        <button
          type="button"
          onClick={() => {
            persist(user.id, { lastDismissedAt: new Date().toISOString() })
            captureEvent('email_verify_prompt_dismissed')
            setVisible(false)
          }}
          className="tap-scale flex h-10 flex-1 items-center justify-center rounded-control bg-surface-2 text-sm font-semibold text-ink-2"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
