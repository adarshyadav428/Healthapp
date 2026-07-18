'use client'

import { useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { captureEvent } from '../../lib/posthog/client'

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
export function WeeklyRecapCard({ recap, isPro }: { recap: WeeklyRecap | null; isPro: boolean }) {
  // Only a real recap counts as "viewed" — the placeholder has nothing to read.
  const hasRecap = isPro && recap !== null
  useEffect(() => {
    if (hasRecap) captureEvent('weekly_recap_viewed')
  }, [hasRecap])

  if (!isPro) return null

  if (!recap) {
    return (
      <div className="mt-4 rounded-[24px] bg-surface p-5" style={AIR}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" strokeWidth={2} />
          <p className="text-[14px] font-bold text-ink">Your weekly recap</p>
        </div>
        <p className="mt-1.5 text-[13px] text-ink-3">Your first recap lands this Sunday — keep logging through the week.</p>
      </div>
    )
  }

  const delta = recap.weightDeltaKg
  return (
    <div className="mt-4 rounded-[24px] bg-surface p-5" style={AIR}>
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand" strokeWidth={2} />
        <p className="text-[14px] font-bold text-ink">Your week</p>
      </div>

      <div className="mt-3 flex gap-6">
        <div>
          <p className="font-display text-[22px] font-bold tabular-nums text-ink" style={{ letterSpacing: '-0.02em' }}>{recap.daysLogged}<span className="text-[13px] font-semibold text-ink-3">/7</span></p>
          <p className="text-[11px] text-ink-3">days logged</p>
        </div>
        <div>
          <p className="font-display text-[22px] font-bold tabular-nums text-ink" style={{ letterSpacing: '-0.02em' }}>{recap.avgKcal.toLocaleString('en-IN')}</p>
          <p className="text-[11px] text-ink-3">avg kcal</p>
        </div>
        {delta != null && (
          <div>
            <p
              className="font-display text-[22px] font-bold tabular-nums"
              style={{ letterSpacing: '-0.02em', color: delta <= 0 ? 'var(--good)' : 'var(--bad)' }}
            >
              {delta > 0 ? '+' : ''}{delta} kg
            </p>
            <p className="text-[11px] text-ink-3">weight</p>
          </div>
        )}
      </div>

      <p className="mt-3.5 text-[13px] leading-relaxed text-ink-2">{recap.message}</p>
    </div>
  )
}
