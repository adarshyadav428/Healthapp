'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LifeBuoy } from 'lucide-react'
import { toast } from '../ui/use-toast'
import { captureEvent } from '../../lib/posthog/client'
import { EVENTS } from '../../lib/posthog/events'

type Props = {
  /** The break a rescue would repair, from findStreakRescue on the server. */
  offer: { date: string; streakAfter: number } | null
}

function friendlyDay(istDate: string): string {
  // Parsed as UTC then read back as UTC so the label can't drift a day either
  // side of a timezone boundary — the key is already an IST calendar date.
  const d = new Date(`${istDate}T00:00:00Z`)
  return d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
}

/**
 * "Your streak broke on Tuesday. Rescue it?"
 *
 * The first thing Pro ever hands over rather than un-blocks — which is the
 * whole reason it exists. Free users never see it: the streak is free
 * territory, and dangling a repairable break in front of someone who can't act
 * on it is an advert wearing a feature's clothes.
 */
export function StreakRescueCard({ offer }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (offer) captureEvent(EVENTS.STREAK_RESCUE_OFFERED, { streak_after: offer.streakAfter })
  }, [offer])

  if (!offer || done) return null

  const rescue = async () => {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/streak/rescue', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)
      setDone(true)
      toast({
        title: `Streak rescued — you're back to ${body.streak} days`,
        duration: 3500,
      })
      // The streak lives in a Server Component, so a refresh is what makes the
      // repaired number appear rather than a stale one until the next nav.
      router.refresh()
    } catch (err) {
      toast({ title: 'Could not rescue it', description: (err as Error).message, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 rounded-card bg-surface p-4" style={{ boxShadow: 'var(--shadow-air)' }}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <LifeBuoy className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body font-bold text-ink">
            You missed {friendlyDay(offer.date)}.
          </p>
          <p className="mt-0.5 text-caption text-ink-2">
            Repair it and your streak goes back to {offer.streakAfter} days. One rescue a month, included with Pro.
          </p>
          <button
            type="button"
            onClick={rescue}
            disabled={busy}
            className="tap-scale mt-3 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-caption font-semibold text-canvas disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {busy ? 'Rescuing…' : 'Rescue my streak'}
          </button>
        </div>
      </div>
    </div>
  )
}
