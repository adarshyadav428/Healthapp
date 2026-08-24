'use client'

import { useEffect, useState } from 'react'
import { MailCheck } from 'lucide-react'
import { useUser } from '../../hooks/useUser'
import { useSendVerificationLink } from '../../hooks/useSendVerificationLink'
import {
  parseVerifyPromptState,
  shouldPromptEmailVerification,
} from '../../lib/emailVerification'
import { captureEvent } from '../../lib/posthog/client'
import { AI_TRIAL_SCANS } from '../../lib/aiTrial'
import { useHomeSlot } from './HomeSlot'

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
 * address can be a typo and nobody would know — costing the user their password
 * reset, and us any way to reach a subscriber about a receipt or refund. So we
 * ask for proof later, once they've had a few days to decide the app is worth
 * keeping — decision logic in lib/emailVerification.ts.
 *
 * The copy leads with the free AI scans rather than the password-reset risk:
 * verifying now unlocks something (lib/aiTrial), and an offer converts far
 * better than a warning about a problem the user doesn't have yet.
 *
 * "Proof" is a magic link sent to the address: clicking it lands on
 * /auth/callback, which stamps profiles.email_verified_at. We can't rely on
 * auth.users.email_confirmed_at, because Supabase auto-stamps that at signup
 * once "Confirm email" is off (see migration 027).
 */
export function VerifyEmailCard() {
  const { user, profile } = useUser()
  const [visible, setVisible] = useState(false)
  const { send, sending, sent } = useSendVerificationLink(user?.email)

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

  // See components/dashboard/HomeSlot.tsx — one attention card on Home.
  const wins = useHomeSlot('verify-email', visible && Boolean(user?.id) && Boolean(user?.email))
  if (!wins || !user?.id || !user.email) return null

  return (
    <div className="mt-4 rounded-card bg-surface p-4" style={{ boxShadow: 'var(--shadow-air)' }}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <MailCheck size={18} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-body font-semibold text-ink">
            Confirm your email for {AI_TRIAL_SCANS} free AI scans
          </p>
          <p className="mt-0.5 text-caption leading-snug text-ink-2">
            {sent ? (
              <>Check {user.email} and tap the link. It may take a minute to arrive.</>
            ) : (
              <>
                We&apos;ll send a link to <span className="font-medium text-ink">{user.email}</span>.
                Tap it to unlock AI photo and chat logging — and so you can reset your
                password if you ever forget it.
              </>
            )}
          </p>
        </div>
      </div>
      <div className="mt-3.5 flex gap-2.5">
        <button
          type="button"
          onClick={() => send('dashboard_card')}
          disabled={sending}
          className="tap-scale flex h-10 flex-1 items-center justify-center rounded-control bg-brand-soft text-body font-semibold text-brand-ink disabled:opacity-60"
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
          className="tap-scale flex h-10 flex-1 items-center justify-center rounded-control bg-surface-2 text-body font-semibold text-ink-2"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
