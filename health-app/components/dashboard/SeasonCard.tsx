'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from '../ui/use-toast'
import type { SeasonState } from '../../lib/seasonServer'

type Props = { state: SeasonState | null }

/**
 * The running season on Home.
 *
 * Home is a room, not a moment, so this obeys the Ember Air rules: ember for
 * the progress fill (that's data), ink for the action. The loud version of a
 * season is its wrap story, not this card.
 */
export function SeasonCard({ state }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (!state) return null
  const { season, joined, progress } = state

  const join = async () => {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/seasons', { method: 'POST' })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error)
      toast({ title: `You're in — ${season.title}`, duration: 2500 })
      router.refresh()
    } catch (err) {
      toast({ title: 'Could not join', description: (err as Error).message, variant: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 rounded-[20px] bg-surface p-[18px]" style={{ boxShadow: 'var(--shadow-air)' }}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">This season</p>
          <p className="font-display mt-1 text-[18px] font-bold text-ink">
            {season.badge.emoji} {season.title}
          </p>
        </div>
        <p className="shrink-0 text-[12px] font-medium tabular-nums text-ink-3">
          {progress.daysLeft} {progress.daysLeft === 1 ? 'day' : 'days'} left
        </p>
      </div>

      {joined ? (
        <>
          <div className="mt-4 flex items-baseline gap-1.5">
            <span className="font-display text-[26px] font-bold tabular-nums text-ink">{progress.done}</span>
            <span className="text-[13px] font-medium text-ink-3">/ {progress.target} days</span>
          </div>

          {/* Ember here is legitimate: this bar IS the data. */}
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-track">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500 ease-out"
              style={{ width: `${Math.round(progress.fraction * 100)}%` }}
            />
          </div>

          <p className="mt-2.5 text-[12.5px] text-ink-2">
            {progress.complete
              ? `Done — ${season.badge.name} is yours. 🎉`
              : progress.outOfReach
              // Never pretend a lost season is still winnable. Saying so plainly
              // keeps the next season's target believable.
              ? 'Out of reach this time — the next season starts fresh.'
              : `${season.target - progress.done} more ${season.target - progress.done === 1 ? 'day' : 'days'} to earn it.`}
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-[13px] text-ink-2">{season.blurb}</p>
          <p className="mt-1.5 text-[12.5px] text-ink-3">
            {season.focus === 'protein'
              ? `Hit your protein target on ${season.target} days.`
              : season.focus === 'weigh_in'
              ? `Weigh in on ${season.target} days.`
              : `Log food on ${season.target} days.`}
          </p>
          <button
            type="button"
            onClick={join}
            disabled={busy}
            className="tap-scale mt-3.5 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-canvas disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {busy ? 'Joining…' : 'Join this season'}
          </button>
        </>
      )}
    </div>
  )
}
