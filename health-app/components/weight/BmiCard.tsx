'use client'

import type { Profile, WeightLog } from '../../types/index'

type BmiCategory = {
  label: string
  emoji: string
  color: string
  soft: string
}

function getBmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return { label: 'Underweight', emoji: '⚠️', color: 'var(--protein)', soft: 'color-mix(in srgb, var(--protein) 8%, transparent)' }
  if (bmi < 25)   return { label: 'Healthy',     emoji: '✅', color: 'var(--good)',    soft: 'color-mix(in srgb, var(--good) 8%, transparent)' }
  if (bmi < 30)   return { label: 'Overweight',  emoji: '⚠️', color: 'var(--energy-ink)', soft: 'var(--energy-soft)' }
  return             { label: 'Obese',           emoji: '🔴', color: 'var(--bad)',     soft: 'var(--bad-soft)' }
}

function getBmiBarPercent(bmi: number): number {
  return Math.min(100, Math.max(0, ((bmi - 10) / 30) * 100))
}

const ZONE_MARKERS = [{ bmi: 18.5, label: '18.5' }, { bmi: 25, label: '25' }, { bmi: 30, label: '30' }]

export function BmiCard({ logs, profile }: { logs: WeightLog[]; profile: Profile }) {
  // Sort descending so index [0] is always the most recent entry
  const sorted = [...logs].sort((a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime())
  const currentWeightKg = sorted.length > 0 ? sorted[0].weight_kg : profile.current_weight_kg
  const heightM = profile.height_cm / 100
  const bmi = currentWeightKg / (heightM * heightM)
  const bmiRounded = Math.round(bmi * 10) / 10
  const cat = getBmiCategory(bmi)
  const barPercent = getBmiBarPercent(bmi)
  const minIdeal = Math.round(18.5 * heightM * heightM * 10) / 10
  const maxIdeal = Math.round(24.9 * heightM * heightM * 10) / 10

  return (
    <div className="rounded-sheet border border-hairline p-4 shadow-rest" style={{ background: cat.soft }}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-2 mb-0.5">Body Mass Index</p>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-3xl font-bold tabular-nums" style={{ color: cat.color }}>{bmiRounded}</span>
            <span className="text-sm text-ink-2">kg/m²</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-card border border-hairline px-3 py-1.5 bg-surface">
          <span className="text-sm">{cat.emoji}</span>
          <span className="text-xs font-bold" style={{ color: cat.color }}>{cat.label}</span>
        </div>
      </div>

      {/* BMI gradient bar */}
      <div className="relative mb-1">
        <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ background: 'linear-gradient(90deg, var(--protein), var(--good), var(--carbs), var(--bad))' }}>
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-surface border-2 border-ink shadow-float transition-all duration-500"
            style={{ left: `calc(${barPercent}% - 7px)` }}
          />
        </div>
      </div>

      {/* Zone labels */}
      <div className="relative flex justify-between text-[9px] text-ink-2 font-medium mb-3 px-0.5">
        {ZONE_MARKERS.map((m) => (
          <span key={m.bmi} style={{ left: `${getBmiBarPercent(m.bmi)}%` }} className="absolute -translate-x-1/2">
            {m.label}
          </span>
        ))}
        <span className="invisible">placeholder</span>
      </div>

      <p className="text-xs text-ink-2 mt-3">
        Healthy weight for your height:{' '}
        <span className="font-bold text-good">{minIdeal}–{maxIdeal} kg</span>
      </p>
    </div>
  )
}
