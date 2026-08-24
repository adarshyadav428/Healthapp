'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { TrendingDown, TrendingUp, Loader2 } from 'lucide-react'
import type { Profile } from '../../types/index'
import { toast } from '../ui/use-toast'
import { Button } from '../ui/button'
import { captureEvent } from '../../lib/posthog/client'
import type { AdaptiveSuggestion } from '../../lib/adaptiveTarget'

const AIR = { boxShadow: 'var(--shadow-air)' } as const

/** One dismissal per ISO week, so declining doesn't mean declining forever. */
function weekKey(uid: string): string {
  const now = new Date()
  const jan1 = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
  const week = Math.floor((now.getTime() - jan1.getTime()) / (7 * 86400000))
  return `gis.targetSuggestionDismissed.${uid}.${now.getUTCFullYear()}w${week}`
}

/**
 * Proposes a calorie-target adjustment when the week's actual weight change
 * disagrees with the chosen pace.
 *
 * The user always accepts explicitly. Nothing here writes a target on its own —
 * a silently-moved calorie goal is the fastest way to make someone stop
 * believing any number in the app, and the maths behind the suggestion is an
 * estimate, not a measurement.
 */
export function AdaptiveTargetCard({ profile }: { profile: Profile }) {
  const router = useRouter()
  const [applying, setApplying] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(weekKey(profile.id)) === '1' } catch { return false }
  })

  const { data } = useQuery({
    queryKey: ['target-suggestion', profile.id],
    queryFn: async () => {
      const res = await fetch('/api/targets/suggestion')
      if (!res.ok) return { suggestion: null }
      return res.json() as Promise<{ suggestion: AdaptiveSuggestion | null }>
    },
    // The inputs only move once a day at most — don't refetch on every focus.
    staleTime: 60 * 60 * 1000,
  })

  const suggestion = data?.suggestion ?? null
  if (!suggestion || dismissed) return null

  const isIncrease = suggestion.deltaKcal > 0

  const dismiss = () => {
    setDismissed(true)
    try { localStorage.setItem(weekKey(profile.id), '1') } catch { /* fail open */ }
    captureEvent('target_suggestion_dismissed', { delta: suggestion.deltaKcal })
  }

  const accept = async () => {
    if (applying) return
    setApplying(true)
    try {
      // Same path Settings uses for a manual target change — one place that
      // knows how to persist a custom target.
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: profile.display_name ?? '',
          height_cm: profile.height_cm,
          current_weight_kg: profile.current_weight_kg,
          target_weight_kg: profile.target_weight_kg,
          activity_level: profile.activity_level,
          goal: profile.goal,
          water_target_ml: profile.water_target_ml ?? 2500,
          custom_calorie_target: suggestion.newTarget,
          custom_protein_target: profile.protein_g_target,
          custom_carbs_target: profile.carbs_g_target,
          custom_fat_target: profile.fat_g_target,
        }),
      })
      if (!res.ok) throw new Error('Could not update your target')
      captureEvent('target_suggestion_accepted', {
        delta: suggestion.deltaKcal,
        new_target: suggestion.newTarget,
      })
      toast({
        title: `Target set to ${suggestion.newTarget.toLocaleString()} kcal`,
        description: 'You can change it any time in Profile.',
        duration: 3000,
      })
      setDismissed(true)
      router.refresh()
    } catch (err) {
      toast({ title: 'Could not update', description: (err as Error).message, variant: 'error' })
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="mt-4 rounded-card-lg bg-surface p-5" style={AIR}>
      <div className="flex items-center gap-2">
        {isIncrease
          ? <TrendingUp className="h-4 w-4 text-brand" strokeWidth={2} />
          : <TrendingDown className="h-4 w-4 text-brand" strokeWidth={2} />}
        <p className="text-body font-bold text-ink">A suggested adjustment</p>
      </div>

      <p className="mt-1.5 text-caption text-ink-2">{suggestion.reason}</p>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-title font-bold tabular-nums text-ink">
          {suggestion.newTarget.toLocaleString()}
        </span>
        <span className="text-caption font-semibold text-ink-3">
          kcal/day ({isIncrease ? '+' : ''}{suggestion.deltaKcal})
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        <Button type="button" onClick={accept} disabled={applying} className="flex-1 gap-2 tap-scale">
          {applying && <Loader2 className="h-4 w-4 animate-spin" />}
          {applying ? 'Updating…' : 'Use this target'}
        </Button>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-control px-4 text-caption font-semibold text-ink-3 tap-scale"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
