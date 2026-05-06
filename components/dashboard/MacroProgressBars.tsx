'use client'

import type { DailyTotals, Profile } from '../../types/index'

type MacroCardProps = {
  label: string
  eaten: number
  target: number | null
  unit: string
  color: string
  bg: string
  darkBg: string
}

function MacroCard({ label, eaten, target, unit, color, bg, darkBg }: MacroCardProps) {
  const pct = target && target > 0 ? Math.min((eaten / target) * 100, 100) : 0
  const remaining = target ? Math.max(target - eaten, 0) : null

  return (
    <div className={`rounded-2xl ${bg} ${darkBg} px-3 py-3 flex flex-col gap-1.5`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wide">{label}</span>
        <span className="text-[10px] text-muted">{target ? `/${target}${unit}` : ''}</span>
      </div>
      <p className="text-lg font-black text-foreground leading-none">
        {Math.round(eaten)}<span className="text-xs font-normal text-muted ml-0.5">{unit}</span>
      </p>
      <div className="h-1.5 rounded-full bg-white/70 dark:bg-slate-700/50 overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {remaining !== null && (
        <p className="text-[10px] text-muted">{remaining}{unit} left</p>
      )}
    </div>
  )
}

export function MacroProgressBars({ totals, profile }: { totals: DailyTotals; profile: Profile }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <MacroCard label="Protein" eaten={totals.protein_g} target={profile.protein_g_target} unit="g" color="bg-blue-500" bg="bg-blue-50" darkBg="dark:bg-blue-950/40" />
      <MacroCard label="Carbs"   eaten={totals.carbs_g}   target={profile.carbs_g_target}   unit="g" color="bg-amber-400" bg="bg-amber-50" darkBg="dark:bg-amber-950/40" />
      <MacroCard label="Fat"     eaten={totals.fat_g}     target={profile.fat_g_target}     unit="g" color="bg-rose-400" bg="bg-rose-50" darkBg="dark:bg-rose-950/40" />
    </div>
  )
}
