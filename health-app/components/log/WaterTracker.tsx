'use client'

import { useWaterLogs } from '../../hooks/useWaterLogs'
import { useUser } from '../../hooks/useUser'
import { Droplets, RotateCcw } from 'lucide-react'

const GLASS_ML = 250
const QUICK_OPTIONS = [
  { label: '1 glass', ml: 250 },
  { label: '2 glasses', ml: 500 },
  { label: '1 bottle', ml: 1000 },
  { label: '1.5L', ml: 1500 },
]

type Props = { waterTargetMl: number }

export function WaterTracker({ waterTargetMl }: Props) {
  const { user } = useUser()
  const { logs, totalMl, isLoading, add, undo } = useWaterLogs(user?.id ?? null)

  const target = waterTargetMl > 0 ? waterTargetMl : 2500
  const glasses = Math.floor(totalMl / GLASS_ML)
  const targetGlasses = Math.ceil(target / GLASS_ML)
  const pct = Math.min(100, Math.round((totalMl / target) * 100))
  const hasLogs = logs.length > 0

  const barColor =
    pct >= 100 ? 'bg-emerald-500' :
    pct >= 60  ? 'bg-sky-500' :
    pct >= 30  ? 'bg-sky-400' :
    'bg-sky-300'

  return (
    <div className="rounded-3xl border border-gray-100 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-sky-500" />
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Water</p>
        </div>
        {hasLogs && (
          <button
            type="button"
            onClick={undo}
            className="flex items-center gap-1 text-xs text-muted hover:text-rose-500 transition-colors"
            title="Undo last entry"
          >
            <RotateCcw className="h-3 w-3" />
            Undo
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-end gap-1.5 mb-3">
        <span className="text-3xl font-black text-sky-600 dark:text-sky-400 tabular-nums leading-none">
          {glasses}
        </span>
        <span className="text-sm font-semibold text-muted mb-0.5">/ {targetGlasses} glasses</span>
        <span className="ml-auto text-xs text-muted mb-0.5">{totalMl} / {target} ml</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 w-full rounded-full bg-sky-100 dark:bg-sky-950/40 overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Glass dots */}
      <div className="flex gap-1 flex-wrap mb-4">
        {Array.from({ length: targetGlasses }).map((_, i) => (
          <div
            key={i}
            className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
              i < glasses
                ? 'border-sky-400 bg-sky-400 dark:border-sky-500 dark:bg-sky-500'
                : 'border-sky-200 dark:border-slate-700 bg-transparent'
            }`}
          >
            {i < glasses && (
              <Droplets className="h-2.5 w-2.5 text-white" />
            )}
          </div>
        ))}
        {pct >= 100 && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold ml-1 self-center">✓ Goal met!</span>
        )}
      </div>

      {/* Quick add buttons */}
      <div className="grid grid-cols-4 gap-1.5">
        {QUICK_OPTIONS.map((opt) => (
          <button
            key={opt.ml}
            type="button"
            disabled={isLoading}
            onClick={() => add(opt.ml)}
            className="rounded-xl border border-sky-100 dark:border-sky-900/40 bg-sky-50 dark:bg-sky-950/20 py-2 text-center hover:bg-sky-100 dark:hover:bg-sky-950/40 active:scale-95 transition-all disabled:opacity-50"
          >
            <p className="text-xs font-bold text-sky-700 dark:text-sky-300">+{opt.ml}ml</p>
            <p className="text-[10px] text-sky-500 dark:text-sky-400">{opt.label}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
