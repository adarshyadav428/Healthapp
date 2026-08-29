'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Lock, Crown } from 'lucide-react'
import { captureEvent } from '../../lib/posthog/client'
import type { PaywallSource } from '../../lib/posthog/events'

/**
 * The one locked-state primitive. Two variants:
 *
 *   <ProLock.Chip>  — an inline padlocked pill that stands in for a control a
 *                     free user can't use (a trend range, a Month toggle, the
 *                     step back past the free history window).
 *   <ProLock.Card>  — a full card that NAMES what sits behind the gate, for a
 *                     surface that would otherwise render nothing at all.
 *
 * Before this, every lock in the app was hand-rolled at its call site — three
 * independent implementations that had already drifted apart. The design rule
 * (see app/progress/page.tsx): name the gap, never ship-and-hide. A ProLock
 * never renders a real withheld value; it describes what Pro would show.
 *
 * `reason` is an `/upgrade?reason=` key (see REASON_COPY in app/upgrade/page).
 * `track`, when set, fires one `paywall_viewed { source }` on mount — pass it
 * only where this is the user's first impression of the wall (a brand-new
 * locked surface, or a gate that previously fired nothing). Where the
 * impression already fires elsewhere — `history_limit` fires on /upgrade — leave
 * `track` unset so the funnel doesn't double-count.
 */

export type ProLockReason =
  | 'history'
  | 'custom_foods'
  | 'ai_insights'
  | 'wrapped'
  | 'meal_suggestions'

function useTrack(track: PaywallSource | undefined) {
  useEffect(() => {
    if (track) captureEvent('paywall_viewed', { source: track })
  }, [track])
}

function Chip({
  label,
  reason,
  track,
  className,
}: {
  label: string
  reason: ProLockReason
  track?: PaywallSource
  className?: string
}) {
  useTrack(track)
  return (
    <Link
      href={`/upgrade?reason=${reason}`}
      aria-label={`${label} — upgrade to Pro`}
      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-ink-3 opacity-70 tap-scale ${className ?? ''}`}
    >
      <Lock className="h-2.5 w-2.5" /> {label}
    </Link>
  )
}

function Card({
  title,
  body,
  cta = 'Upgrade',
  reason,
  track,
  className,
}: {
  title: string
  body: string
  cta?: string
  reason: ProLockReason
  track?: PaywallSource
  className?: string
}) {
  useTrack(track)
  return (
    <div
      className={`rounded-[20px] p-4 ${className ?? ''}`}
      style={{ backgroundColor: 'var(--brand-soft)' }}
    >
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 shrink-0 text-brand-ink" />
        <p className="text-[13px] font-bold text-brand-ink">{title}</p>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-brand-ink opacity-80">{body}</p>
      <Link
        href={`/upgrade?reason=${reason}`}
        className="mt-3 inline-flex items-center gap-1 rounded-full bg-cta-grad px-3.5 py-1.5 text-[11px] font-bold text-white tap-scale"
      >
        <Crown className="h-3 w-3" /> {cta}
      </Link>
    </div>
  )
}

export const ProLock = { Chip, Card }
