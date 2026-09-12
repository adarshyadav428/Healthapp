'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ChevronRight } from 'lucide-react'
import type { Profile, WeightLog } from '../../types/index'
import type { WeightTrend } from '../../lib/weightTrend'
import { MIN_DAYS_FOR_TREND } from '../../lib/weightTrend'
import { formatKg } from '../../lib/formatWeight'
import { formatGoalDate } from '../../lib/projection'

// A cool tint for the one body figure — protein blue, the only non-ember hue
// the system allows on data, mixed into the surface the way the food tiles are.
const BMI_TILE = {
  backgroundImage: 'linear-gradient(145deg, color-mix(in srgb, var(--protein) 18%, var(--surface)) 0%, color-mix(in srgb, var(--protein) 6%, var(--surface)) 100%)',
  boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--protein) 22%, transparent)',
} as const

// Defer recharts — the chart is the heaviest thing on the page.
const WeightTrendChart = dynamic(() => import('./WeightTrendChart').then((m) => m.WeightTrendChart), {
  ssr: false,
  loading: () => <div className="h-52 animate-shimmer rounded-card bg-surface-2" />,
})

/**
 * Where the weight stands against the plan — the same arithmetic as
 * `components/weight/WeightStats.tsx`, so the Progress hero and the Weight page
 * can never disagree about "since start" or "to go":
 *  - current   = newest weigh-in, else the profile's current weight
 *  - start     = the immutable onboarding baseline (`start_weight_kg`), else the
 *                oldest weigh-in on hand (P1-9b: a new low must not reset "start")
 *  - progress  = share of the start→goal distance covered, clamped 0–100
 */
export function weightSummary(weightLogs: WeightLog[], profile: Profile) {
  // Newest-first, as the page fetches them. Coerced: every weight column is an
  // unconstrained numeric that PostgREST serialises as a string (lib/formatWeight).
  const current = Number(weightLogs[0]?.weight_kg ?? profile.current_weight_kg)
  const starting = Number(profile.start_weight_kg ?? weightLogs[weightLogs.length - 1]?.weight_kg ?? profile.current_weight_kg)
  const target = Number(profile.target_weight_kg)
  const delta = Number((current - starting).toFixed(1))
  const toTarget = Number((current - target).toFixed(1))
  const isLosing = profile.goal === 'lose'
  const progress = isLosing
    ? starting > target ? Math.min(((starting - current) / (starting - target)) * 100, 100) : 0
    : target > starting ? Math.min(((current - starting) / (target - starting)) * 100, 100) : 0
  return { current, starting, target, delta, toTarget, isLosing, progress: Math.max(0, progress) }
}

export function WeightHero({ weightLogs, profile, trend, bmi, bmiLabel }: {
  weightLogs: WeightLog[]
  profile: Profile
  trend: WeightTrend
  /** Raw BMI for the current weight, or null without a height. */
  bmi?: number | null
  bmiLabel?: string | null
}) {
  const s = weightSummary(weightLogs, profile)
  const atGoal = Math.abs(s.toTarget) < 0.5
  const hasWeighIns = weightLogs.length > 0
  const hasTrend = trend.kgPerWeek !== null

  // "3.2 kg lost" is good news on a cut and bad news on a bulk; the colour
  // follows the goal, the words follow the scale.
  const deltaLabel = s.delta < 0 ? `${Math.abs(s.delta)} kg lost` : s.delta > 0 ? `${s.delta} kg gained` : 'No change'
  const movingRight = s.isLosing ? s.delta < 0 : s.delta > 0
  const deltaClass = s.delta === 0 ? 'text-ink-2' : movingRight ? 'text-good' : 'text-brand-text'

  return (
    <section aria-label="Weight">
      <h2 className="font-display text-title-sm font-semibold text-ink">Weight</h2>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-caption font-medium text-ink-3">Current</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-hero font-semibold tabular-nums leading-none text-ink">{formatKg(s.current)}</span>
            <span className="text-title-sm text-ink-2">kg</span>
          </p>
        </div>
        {bmi != null && (
          <div className="rounded-control px-3 py-2 text-right" style={BMI_TILE}>
            <p className="text-micro font-medium text-ink-3">BMI</p>
            <p className="font-display text-title-sm font-semibold tabular-nums leading-tight text-ink">{bmi.toFixed(1)}</p>
            {bmiLabel && <p className="text-micro text-ink-2">{bmiLabel}</p>}
          </div>
        )}
      </div>

      {hasWeighIns ? (
        <p className="mt-3 text-body text-ink-2">
          <span className={`font-semibold ${deltaClass}`}>{deltaLabel}</span> since start
          {atGoal ? <> · <span className="font-semibold text-good">at your goal</span></> : <> · {Math.abs(s.toTarget)} kg to go</>}
        </p>
      ) : (
        <p className="mt-3 text-body text-ink-2">From your profile — weigh in to start the trend.</p>
      )}

      {/* Start → goal. Ember is spent here because this is the number that moves. */}
      {hasWeighIns && s.progress > 0 && (
        <div className="mt-4" aria-label={`${Math.round(s.progress)}% of the way to ${formatKg(s.target)} kg`}>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-cta-grad" style={{ width: `${s.progress}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-micro tabular-nums text-ink-3">
            <span>{formatKg(s.starting)} kg</span>
            <span className="font-semibold text-ink-2">{Math.round(s.progress)}%</span>
            <span>{formatKg(s.target)} kg goal</span>
          </div>
        </div>
      )}

      {/* The smoothed answer to "am I actually moving?" — only once there is
          enough of a span for the slope to mean something. */}
      {hasTrend && (
        <p className="mt-4 text-caption text-ink-2">
          {Math.abs(trend.kgPerWeek!) < 0.05
            ? 'Holding steady on a 4-week average.'
            : <>{trend.kgPerWeek! < 0 ? 'Down' : 'Up'} <span className="font-semibold text-ink">{Math.abs(trend.kgPerWeek!).toFixed(2)} kg a week</span> on a 4-week average.</>}
          {trend.projectedDate && (
            <> On track for <span className="font-semibold text-ink">{formatKg(profile.target_weight_kg)} kg</span> around {formatGoalDate(trend.projectedDate)}.</>
          )}
        </p>
      )}

      {trend.points.length >= 2 ? (
        <div className="mt-4">
          <WeightTrendChart points={trend.points} targetKg={profile.target_weight_kg ?? null} hasTrend={hasTrend} />
          {!hasTrend && (
            <p className="mt-1 text-micro text-ink-3">The trend line firms up after {MIN_DAYS_FOR_TREND} days of weigh-ins.</p>
          )}
        </div>
      ) : (
        <Link href="/weight" className="mt-4 flex h-12 items-center justify-between rounded-control border border-hairline bg-surface px-4 text-body font-medium text-ink shadow-air tap-scale">
          Log a weigh-in
          <ChevronRight className="h-5 w-5 text-ink-3" strokeWidth={1.75} />
        </Link>
      )}
    </section>
  )
}
