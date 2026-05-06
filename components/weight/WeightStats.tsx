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

  const bmi = profile.height_cm
    ? +(current / Math.pow(profile.height_cm / 100, 2)).toFixed(1)
    : null

  const deltaLabel = delta < 0 ? `${Math.abs(delta)} kg lost` : delta > 0 ? `${delta} kg gained` : 'No change'
  const deltaColor = isLosing ? (delta < 0 ? 'text-emerald-600' : delta > 0 ? 'text-rose-500' : 'text-gray-500') : (delta > 0 ? 'text-emerald-600' : 'text-gray-500')

  // Goal prediction: use actual rate of change if ≥2 entries, else use profile pace
  let weeksToGoal: number | null = null
  let rateLabel: string | null = null
  const kgRemaining = Math.abs(current - target)
  if (kgRemaining > 0.2) {
    if (sorted.length >= 2) {
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
  }

  return (
    <div className="space-y-3">
      {/* Current weight hero */}
      <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 shadow-sm">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Current weight</p>
            <p className="text-5xl font-black text-gray-900 mt-1 leading-none">{current}</p>
            <p className="text-base text-gray-500 mt-0.5">kg</p>
            <p className={`text-sm font-bold mt-2 ${deltaColor}`}>{deltaLabel} since start</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Goal</p>
            <p className="text-2xl font-black text-emerald-700">{target} kg</p>
            <p className={`text-xs font-semibold mt-1 ${Math.abs(toTarget) < 0.5 ? 'text-emerald-600' : 'text-gray-500'}`}>
              {Math.abs(toTarget) < 0.5 ? '🎯 At goal!' : `${Math.abs(toTarget)} kg to go`}
            </p>
          </div>
        </div>

        {/* Progress bar to goal */}
        {progressToTarget > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{starting} kg start</span>
              <span>{target} kg goal</span>
            </div>
            <div className="h-2 rounded-full bg-white/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-700"
                style={{ width: `${progressToTarget}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-emerald-600 font-semibold">{Math.round(progressToTarget)}% to goal</p>
              {weeksToGoal !== null && (
                <p className="text-xs text-gray-400">
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
        <StatCard label="BMI" value={bmi !== null ? String(bmi) : '--'} sub={bmi !== null ? (bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Overweight' : 'Obese') : ''} subColor={bmi === null ? '' : bmi < 25 && bmi >= 18.5 ? 'text-emerald-600' : 'text-amber-600'} />
        <StatCard label="Entries" value={String(sorted.length)} sub={sorted.length > 0 ? 'logged' : 'Start now'} />
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, subColor = 'text-gray-400' }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white/90 p-3 shadow-sm text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-lg font-black text-gray-900 mt-0.5 leading-none">{value}</p>
      {sub && <p className={`text-xs mt-0.5 font-medium ${subColor}`}>{sub}</p>}
    </div>
  )
}
