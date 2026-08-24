'use client'

import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { useUser } from '../../hooks/useUser'
import { isPlayBillingAvailable } from '../../lib/play/billing'
import {
  PLAY_STORE_URL,
  parseRatePromptState,
  shouldShowRatePrompt,
} from '../../lib/ratePrompt'
import { captureEvent } from '../../lib/posthog/client'

const storageKey = (uid: string) => `gis.ratePrompt.${uid}`

function persist(uid: string, patch: { rated?: boolean; lastDismissedAt?: string }) {
  try {
    const prev = parseRatePromptState(localStorage.getItem(storageKey(uid)))
    localStorage.setItem(storageKey(uid), JSON.stringify({ ...prev, ...patch }))
  } catch {
    /* noop — worst case we ask again */
  }
}

/**
 * "Rate us on Google Play" card. Renders nothing until every condition
 * passes (streak ≥ 3, running inside the installed Play build, not
 * rated/recently dismissed) so web users never see layout shift.
 * Decision logic lives in lib/ratePrompt.ts.
 */
export function RatePromptCard({ streakDays }: { streakDays: number }) {
  const { user } = useUser()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    const uid = user.id

    const check = async () => {
      // Digital Goods API only exists inside the Play-installed TWA — the
      // same signal the upgrade page uses to pick Play Billing.
      const inPlayTwa = await isPlayBillingAvailable()
      if (cancelled) return
      let state = null
      try {
        state = parseRatePromptState(localStorage.getItem(storageKey(uid)))
      } catch {
        /* fail open */
      }
      setVisible(shouldShowRatePrompt({ streakDays, inPlayTwa, state }))
    }

    check()
    return () => {
      cancelled = true
    }
  }, [user?.id, streakDays])

  if (!visible || !user?.id) return null

  return (
    <div
      className="mt-4 rounded-card bg-surface p-4"
      style={{ boxShadow: 'var(--shadow-air)' }}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Star size={18} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <p className="text-body font-semibold text-ink">Enjoying GetInShape?</p>
          <p className="mt-0.5 text-caption leading-snug text-ink-2">
            {streakDays}-day streak! A quick rating on Google Play helps others find us.
          </p>
        </div>
      </div>
      <div className="mt-3.5 flex gap-2.5">
        <a
          href={PLAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            persist(user.id, { rated: true })
            captureEvent('rate_prompt_clicked')
            setVisible(false)
          }}
          className="tap-scale flex h-10 flex-1 items-center justify-center rounded-control bg-brand-soft text-body font-semibold text-brand-ink"
        >
          Rate on Play
        </a>
        <button
          type="button"
          onClick={() => {
            persist(user.id, { lastDismissedAt: new Date().toISOString() })
            captureEvent('rate_prompt_dismissed')
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
