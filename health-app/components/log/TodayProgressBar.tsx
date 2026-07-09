// Server-rendered compact progress strip shown at the top of the Log page.
// Shows today's kcal eaten vs goal + macro bars at a glance.

type Props = {
  kcalEaten: number
  kcalTarget: number
  proteinEaten: number
  proteinTarget: number
  carbsEaten: number
  carbsTarget: number
  fatEaten: number
  fatTarget: number
}

function MacroBar({
  label,
  eaten,
  target,
  color,
}: {
  label: string
  eaten: number
  target: number
  color: string
}) {
  const pct = target > 0 ? Math.min((eaten / target) * 100, 100) : 0
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] font-semibold text-muted">{label}</span>
        <span className="text-[10px] font-bold text-foreground">{eaten}g</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function TodayProgressBar({
  kcalEaten,
  kcalTarget,
  proteinEaten,
  proteinTarget,
  carbsEaten,
  carbsTarget,
  fatEaten,
  fatTarget,
}: Props) {
  if (kcalTarget <= 0) return null

  const kcalPct = Math.min((kcalEaten / kcalTarget) * 100, 100)
  const remaining = Math.max(kcalTarget - kcalEaten, 0)
  const over = kcalEaten > kcalTarget ? kcalEaten - kcalTarget : 0
  const ringColor =
    kcalPct < 80 ? 'bg-emerald-500' : kcalPct <= 100 ? 'bg-amber-500' : 'bg-rose-500'

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-slate-50 px-4 py-3 shadow-sm">
      {/* Calorie row */}
      <div className="flex items-center gap-3 mb-2.5">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-indigo-700">
              {kcalEaten.toLocaleString()} <span className="font-normal text-indigo-500">/ {kcalTarget.toLocaleString()} kcal</span>
            </span>
            <span className={`text-xs font-bold ${over > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {over > 0 ? `+${over} over` : `${remaining} left`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-indigo-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${ringColor}`}
              style={{ width: `${kcalPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Macro bars */}
      <div className="flex gap-3">
        <MacroBar label="Protein" eaten={proteinEaten} target={proteinTarget} color="bg-blue-400" />
        <MacroBar label="Carbs" eaten={carbsEaten} target={carbsTarget} color="bg-amber-400" />
        <MacroBar label="Fat" eaten={fatEaten} target={fatTarget} color="bg-rose-400" />
      </div>
    </div>
  )
}
