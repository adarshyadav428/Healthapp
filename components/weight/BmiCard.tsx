'use client'

import type { Profile, WeightLog } from '../../types/index'

type BmiCategory = {
  label: string
  emoji: string
  color: string
  darkColor: string
  bg: string
  darkBg: string
  border: string
  darkBorder: string
  bar: string
}

function getBmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return { label: 'Underweight', emoji: '⚠️', color: 'text-blue-700', darkColor: 'dark:text-blue-300', bg: 'bg-blue-50', darkBg: 'dark:bg-blue-950/30', border: 'border-blue-100', darkBorder: 'dark:border-blue-900/30', bar: 'bg-blue-400' }
  if (bmi < 25)   return { label: 'Healthy', emoji: '✅', color: 'text-emerald-700', darkColor: 'dark:text-emerald-300', bg: 'bg-emerald-50', darkBg: 'dark:bg-emerald-950/30', border: 'border-emerald-100', darkBorder: 'dark:border-emerald-900/30', bar: 'bg-emerald-500' }
  if (bmi < 30)   return { label: 'Overweight', emoji: '⚠️', color: 'text-amber-700', darkColor: 'dark:text-amber-300', bg: 'bg-amber-50', darkBg: 'dark:bg-amber-950/30', border: 'border-amber-100', darkBorder: 'dark:border-amber-900/30', bar: 'bg-amber-500' }
  return           { label: 'Obese', emoji: '🔴', color: 'text-rose-700', darkColor: 'dark:text-rose-300', bg: 'bg-rose-50', darkBg: 'dark:bg-rose-950/30', border: 'border-rose-100', darkBorder: 'dark:border-rose-900/30', bar: 'bg-rose-500' }
}

function getBmiBarPercent(bmi: number): number {
  return Math.min(100, Math.max(0, ((bmi - 10) / 30) * 100))
}

const ZONE_MARKERS = [{ bmi: 18.5, label: '18.5' }, { bmi: 25, label: '25' }, { bmi: 30, label: '30' }]

export function BmiCard({ logs, profile }: { logs: WeightLog[]; profile: Profile }) {
  const currentWeightKg = logs.length > 0 ? logs[0].weight_kg : profile.current_weight_kg
  const heightM = profile.height_cm / 100
  const bmi = currentWeightKg / (heightM * heightM)
  const bmiRounded = Math.round(bmi * 10) / 10
  const cat = getBmiCategory(bmi)
  const barPercent = getBmiBarPercent(bmi)
  const minIdeal = Math.round(18.5 * heightM * heightM * 10) / 10
  const maxIdeal = Math.round(24.9 * heightM * heightM * 10) / 10

  return (
    <div className={`rounded-3xl border ${cat.border} ${cat.darkBorder} ${cat.bg} ${cat.darkBg} p-4 shadow-sm`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-0.5">Body Mass Index</p>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-3xl font-black ${cat.color} ${cat.darkColor}`}>{bmiRounded}</span>
            <span className="text-sm text-muted">kg/m²</span>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 rounded-2xl px-3 py-1.5 ${cat.bg} ${cat.darkBg} border ${cat.border} ${cat.darkBorder}`}>
          <span className="text-sm">{cat.emoji}</span>
          <span className={`text-xs font-bold ${cat.color} ${cat.darkColor}`}>{cat.label}</span>
        </div>
      </div>

      {/* BMI gradient bar */}
      <div className="relative mb-1">
        <div className="h-2.5 w-full rounded-full overflow-hidden bg-gradient-to-r from-blue-300 via-emerald-400 via-amber-400 to-rose-400">
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-gray-700 dark:border-slate-300 shadow-md transition-all duration-500"
            style={{ left: `calc(${barPercent}% - 7px)` }}
          />
        </div>
      </div>

      {/* Zone labels */}
      <div className="relative flex justify-between text-[9px] text-muted font-medium mb-3 px-0.5">
        {ZONE_MARKERS.map((m) => (
          <span key={m.bmi} style={{ left: `${getBmiBarPercent(m.bmi)}%` }} className="absolute -translate-x-1/2">
            {m.label}
          </span>
        ))}
        <span className="invisible">placeholder</span>
      </div>

      <p className="text-xs text-muted mt-3">
        Healthy weight for your height:{' '}
        <span className="font-bold text-emerald-700 dark:text-emerald-400">{minIdeal}–{maxIdeal} kg</span>
      </p>
    </div>
  )
}
