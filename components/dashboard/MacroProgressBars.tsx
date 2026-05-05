'use client'

import type { DailyTotals, Profile } from '../../types/index'

type MacroCardProps = {
  label: string
  eaten: number
  target: number | null
  unit: string
  color: string
  bg: string
}

function MacroCard({ label, eaten, target, unit, color, bg }: MacroCardProps) {
  const pct = target && target > 0 ? Math.min((eaten / target) * 100, 100) : 0
  const remaining = target ? Math.max(target - eaten, 0) : null

  return (
    <div className={`rounded-xl ${bg} px-3 py-3 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</span>
        <span className="text-xs text-gray-400">{target ? `/${target}${unit}` : ''}</span>
      </div>
      <p className="text-xl font-black text-gray-900 leading-none">
        {Math.round(eaten)}<span className="text-sm font-normal text-gray-500 ml-0.5">{unit}</span>
      </p>
      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-white/60 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {remaining !== null && (
        <p className="text-xs text-gray-500">{remaining}{unit} left</p>
      )}
    </div>
  )
}

export function MacroProgressBars({ totals, profile }: { totals: DailyTotals; profile: Profile }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <MacroCard
        label="Protein"
        eaten={totals.protein_g}
        target={profile.protein_g_target}
        unit="g"
        color="bg-blue-500"
        bg="bg-blue-50"
      />
      <MacroCard
        label="Carbs"
        eaten={totals.carbs_g}
        target={profile.carbs_g_target}
        unit="g"
        color="bg-amber-400"
        bg="bg-amber-50"
      />
      <MacroCard
        label="Fat"
        eaten={totals.fat_g}
        target={profile.fat_g_target}
        unit="g"
        color="bg-rose-400"
        bg="bg-rose-50"
      />
    </div>
  )
}
