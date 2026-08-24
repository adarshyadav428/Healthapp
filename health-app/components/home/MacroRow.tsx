interface MacroItemProps {
  label: string
  color: string
  eaten: number
  target: number
}

function MacroItem({ label, color, eaten, target }: MacroItemProps) {
  const pct = target > 0 ? Math.min(eaten / target, 1) : 0
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-micro font-medium uppercase tracking-caps text-ink-3">{label}</span>
        <span className="text-caption font-medium text-ink-2 tabular-nums">
          {Math.round(eaten)} / {Math.round(target)}g
        </span>
      </div>
      <div className="h-1 rounded-full overflow-hidden bg-track">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct * 100}%`, background: color }}
        />
      </div>
    </div>
  )
}

interface Props {
  proteinEaten: number
  carbsEaten: number
  fatEaten: number
  proteinTarget: number
  carbsTarget: number
  fatTarget: number
}

export function MacroRow({ proteinEaten, carbsEaten, fatEaten, proteinTarget, carbsTarget, fatTarget }: Props) {
  return (
    <div className="grid grid-cols-3 gap-[18px] border-t border-hairline pt-[18px]">
      <MacroItem label="Protein" color="var(--protein)" eaten={proteinEaten} target={proteinTarget} />
      <MacroItem label="Carbs"   color="var(--carbs)"   eaten={carbsEaten}   target={carbsTarget}   />
      <MacroItem label="Fat"     color="var(--fat)"     eaten={fatEaten}     target={fatTarget}     />
    </div>
  )
}
