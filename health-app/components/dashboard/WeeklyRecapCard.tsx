'use client'

import { useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { captureEvent } from '../../lib/posthog/client'
import { useHomeSlot } from './HomeSlot'

export type WeeklyRecap = {
  daysLogged: number
  avgKcal: number
  weightDeltaKg: number | null
  message: string
}

const AIR = { boxShadow: 'var(--shadow-air)' } as const

/**
 * Pro-only "Your week" card. Renders the latest stored weekly recap; for a Pro
 * user who hasn't had their first Sunday yet, a gentle placeholder so the
 * feature is discoverable. Non-Pro users see nothing (the paywall sells it).
 */
export function WeeklyRecapCard({ recap, isPro, dailyTarget, streakDays }: {
  recap: WeeklyRecap | null
  isPro: boolean
  /** Daily calorie target, for the derived "vs target" card. */
  dailyTarget?: number
  /** Current streak, for the fifth card. */
  streakDays?: number
}) {
  // Only a real recap counts as "viewed" — the placeholder has nothing to read.
  const hasRecap = isPro && recap !== null
  useEffect(() => {
    if (hasRecap) captureEvent('weekly_recap_viewed')
  }, [hasRecap])

  // See components/dashboard/HomeSlot.tsx — one attention card on Home.
  const wins = useHomeSlot('weekly-recap', isPro)
  if (!wins) return null

  if (!recap) {
    return (
      <div className="mt-4 rounded-card-lg bg-surface p-5" style={AIR}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" strokeWidth={2} />
          <p className="text-body font-bold text-ink">Your weekly recap</p>
        </div>
        <p className="mt-1.5 text-caption text-ink-3">Your first recap lands this Sunday — keep logging through the week.</p>
      </div>
    )
  }

  const delta = recap.weightDeltaKg
  // Two of the five are derived rather than stored — vs-target from the
  // profile, streak from what Home already computes — so the extra cards
  // needed no schema change and cannot drift from the numbers elsewhere.
  const vsTarget = dailyTarget && dailyTarget > 0 && recap.avgKcal > 0
    ? recap.avgKcal - dailyTarget
    : null

  const cards: { value: string; label: string; color?: string }[] = [
    { value: `${recap.daysLogged}/7`, label: 'days logged' },
    { value: recap.avgKcal.toLocaleString('en-IN'), label: 'avg kcal' },
  ]
  if (vsTarget != null) {
    cards.push({
      value: `${vsTarget > 0 ? '+' : ''}${vsTarget.toLocaleString('en-IN')}`,
      label: 'vs target',
      // Under target is the goal when losing; over is worth flagging, not scolding.
      color: vsTarget <= 0 ? 'var(--good)' : 'var(--bad)',
    })
  }
  if (delta != null) {
    cards.push({
      value: `${delta > 0 ? '+' : ''}${delta} kg`,
      label: 'weight',
      color: delta <= 0 ? 'var(--good)' : 'var(--bad)',
    })
  }
  if (streakDays != null && streakDays > 0) {
    cards.push({ value: String(streakDays), label: 'day streak' })
  }

  return (
    <div className="mt-4 rounded-card-lg bg-surface p-5" style={AIR}>
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand" strokeWidth={2} />
        <p className="text-body font-bold text-ink">Your week</p>
      </div>

      {/* Wraps rather than scrolls — a card that needs a swipe to discover
          may as well not exist on the one screen people actually read. */}
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
        {cards.map((card) => (
          <div key={card.label}>
            <p
              className="font-display text-title font-bold tabular-nums text-ink"
              style={{ ...(card.color ? { color: card.color } : {}) }}
            >
              {card.value}
            </p>
            <p className="text-micro text-ink-3">{card.label}</p>
          </div>
        ))}
      </div>

      <p className="mt-3.5 text-caption leading-relaxed text-ink-2">{recap.message}</p>
    </div>
  )
}
