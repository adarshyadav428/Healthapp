 'use client'

import type { WeightLog, Profile } from '../../types/index'

export function WeightStats({ logs, profile }: { logs: WeightLog[]; profile: Profile }) {
  const sorted = logs.slice().sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())
  const starting = sorted[0]?.weight_kg ?? profile.current_weight_kg
  const current = sorted[sorted.length - 1]?.weight_kg ?? profile.current_weight_kg
  const delta = Number((starting - current).toFixed(1))

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="text-xs text-gray-500">Current</p>
        <p className="text-lg font-semibold text-gray-900">{current} kg</p>
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="text-xs text-gray-500">Starting</p>
        <p className="text-lg font-semibold text-gray-900">{starting} kg</p>
      </div>
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <p className="text-xs text-gray-500">Total lost</p>
        <p className="text-lg font-semibold text-gray-900">{delta} kg</p>
      </div>
    </div>
  )
}
