'use client'

import type { WeightLog, Profile } from '../../types/index'

export function WeightStats({ logs, profile }: { logs: WeightLog[] | null | undefined; profile: Profile }) {
  const sorted = (logs ?? []).slice().sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
  const current = sorted[sorted.length - 1]?.weight_kg ?? profile.current_weight_kg
  const starting = sorted[0]?.weight_kg ?? profile.current_weight_kg
  const target = profile.target_weight_kg
  const delta = Number((current - starting).toFixed(1))
  const toTarget = Number((current - target).toFixed(1))
  const isLosing = profile.goal === 'lose'
  const progressToTarget = isLosing
    ? starting > target ? Math.min(((starting - current) / (starting - target)) * 100, 100) : 0
    : target > starting ? Math.min(((current - starting) / (target - starting)) * 100, 100) : 0

  const bmi = profile.height_cm ? +(current / Math.pow(profile.height_cm / 100, 2)).toFixed(1) : null
  const deltaLabel = delta < 0 ? `${Math.abs(delta)} kg lost` : delta > 0 ? `${delta} kg gained` : 'No change'
  const deltaColor = isLosing
    ? delta < 0 ? 'var(--good)' : delta > 0 ? 'var(--bad)' : 'var(--ink-2)'
    : delta > 0 ? 'var(--good)' : 'var(--ink-2)'

  let weeksToGoal: number | null = null
  let rateLabel: string | null = null
  const kgRemaining = Math.abs(current - target)
  if (kgRemaining > 0.2 && sorted.length >= 2) {
    const firstEntry = sorted[0]
    const lastEntry = sorted[sorted.length - 1]
    const daysDiff = (new Date(lastEntry.measured_at).getTime() - new Date(firstEntry.measured_at).getTime()) / 86400000
    const kgPerDay = daysDiff > 0 ? Math.abs(lastEntry.weight_kg - firstEntry.weight_kg) / daysDiff : 0
    const movingRight = isLosing ? lastEntry.weight_kg < firstEntry.weight_kg : lastEntry.weight_kg > firstEntry.weight_kg
    if (kgPerDay > 0.001 && movingRight) {
      weeksToGoal = Math.ceil(kgRemaining / (kgPerDay * 7))
      rateLabel = `at ${(kgPerDay * 7).toFixed(2)} kg/week`
    }
  }

  return (
    <div className="space-y-3">
      {/* Current weight hero */}
      <div className="rounded-sheet border border-hairline p-5 shadow-rest" style={{ background: 'color-mix(in srgb, var(--good) 6%, transparent)' }}>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-good">Current weight</p>
            <p className="font-display text-5xl font-bold text-ink mt-1 leading-none tabular-nums">{current}</p>
            <p className="text-base text-ink-2 mt-0.5">kg</p>
            <p className="text-sm font-bold mt-2 tabular-nums" style={{ color: deltaColor }}>{deltaLabel} since start</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-ink-2">Goal</p>
            <p className="text-2xl font-bold text-good tabular-nums">{target} kg</p>
            <p className="text-xs font-semibold mt-1" style={{ color: Math.abs(toTarget) < 0.5 ? 'var(--good)' : 'var(--ink-2)' }}>
              {Math.abs(toTarget) < 0.5 ? '🎯 At goal!' : `${Math.abs(toTarget)} kg to go`}
            </p>
          </div>
        </div>

        {progressToTarget > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-ink-2 mb-1">
              <span>{starting} kg start</span>
              <span>{target} kg goal</span>
            </div>
            <div className="h-2 rounded-full bg-surface overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progressToTarget}%`, background: 'var(--good)' }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-good font-semibold">{Math.round(progressToTarget)}% to goal</p>
              {weeksToGoal !== null && (
                <p className="text-xs text-ink-2">
                  ~{weeksToGoal < 52 ? `${weeksToGoal}w` : `${Math.round(weeksToGoal / 4.3)}mo`} {rateLabel}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Start" value={`${starting} kg`} />
        <StatCard
          label="BMI"
          value={bmi !== null ? String(bmi) : '--'}
          sub={bmi !== null ? (bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Overweight' : 'Obese') : ''}
          subColor={bmi === null ? 'var(--ink-2)' : bmi < 25 && bmi >= 18.5 ? 'var(--good)' : 'var(--energy-ink)'}
        />
        <StatCard label="Entries" value={String(sorted.length)} sub={sorted.length > 0 ? 'logged' : 'Start now'} />
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, subColor = 'var(--ink-2)' }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-3 shadow-rest text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">{label}</p>
      <p className="text-lg font-bold text-ink mt-0.5 leading-none tabular-nums">{value}</p>
      {sub && <p className="text-xs mt-0.5 font-medium" style={{ color: subColor }}>{sub}</p>}
    </div>
  )
}
