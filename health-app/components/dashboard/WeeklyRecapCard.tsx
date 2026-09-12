'use client'

import { useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { captureEvent } from '../../lib/posthog/client'
import { ProLock } from '../ui/ProLock'

export type WeeklyRecap = {
  daysLogged: number
  avgKcal: number
  weightDeltaKg: number | null
  message: string
}

/**
 * "Your week" card. Renders the latest stored weekly recap for Pro; a gentle
 * placeholder for a Pro user still waiting on their first Sunday; and — for a
 * free user — a locked card that NAMES the feature. It used to render nothing
 * at all for free users, so the single best recurring-desire surface in the app
 * was invisible to the people it's meant to convert.
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

  if (!isPro) {
    return (
      <ProLock.Card
        className="mt-8"
        reason="ai_insights"
        track="recap_card"
        title="Your weekly recap"
        body="Every Sunday, Pro writes up your week — average calories, days logged and weight change — in a short paragraph you can read in ten seconds."
        cta="See what Pro adds"
      />
    )
  }

  if (!recap) {
    return (
      <div className="mt-8 rounded-card border border-hairline bg-surface p-5 shadow-air">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" strokeWidth={2} aria-hidden="true" />
          <p className="text-body font-semibold text-ink">Your weekly recap</p>
        </div>
        <p className="mt-1 text-caption text-ink-3">Your first recap lands this Sunday — keep logging through the week.</p>
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
    <div className="mt-8 rounded-card border border-hairline bg-surface p-5 shadow-air">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand" strokeWidth={2} aria-hidden="true" />
        <p className="text-body font-semibold text-ink">Your week</p>
      </div>

      {/* Wraps rather than scrolls — a card that needs a swipe to discover
          may as well not exist on the one screen people actually read. */}
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
        {cards.map((card) => (
          <div key={card.label}>
            <p
              className="font-display text-title-sm font-semibold tabular-nums text-ink"
              style={card.color ? { color: card.color } : undefined}
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
