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
        <span className="text-[10px] font-semibold text-ink-2">{label}</span>
        <span className="text-[10px] font-bold text-ink tabular-nums">{eaten}g</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: color }}
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
  const ringColor = kcalPct < 80 ? 'var(--good)' : kcalPct <= 100 ? 'var(--energy)' : 'var(--bad)'

  return (
    <div className="rounded-card border border-hairline bg-brand-soft px-4 py-3 shadow-rest">
      {/* Calorie row */}
      <div className="flex items-center gap-3 mb-2.5">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-brand-ink tabular-nums">
              {kcalEaten.toLocaleString()} <span className="font-normal text-ink-2">/ {kcalTarget.toLocaleString()} kcal</span>
            </span>
            <span className="text-xs font-bold tabular-nums" style={{ color: over > 0 ? 'var(--bad)' : 'var(--good)' }}>
              {over > 0 ? `+${over} over` : `${remaining} left`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${kcalPct}%`, background: ringColor }}
            />
          </div>
        </div>
      </div>

      {/* Macro bars */}
      <div className="flex gap-3">
        <MacroBar label="Protein" eaten={proteinEaten} target={proteinTarget} color="var(--protein)" />
        <MacroBar label="Carbs" eaten={carbsEaten} target={carbsTarget} color="var(--carbs)" />
        <MacroBar label="Fat" eaten={fatEaten} target={fatTarget} color="var(--fat)" />
      </div>
    </div>
  )
}
