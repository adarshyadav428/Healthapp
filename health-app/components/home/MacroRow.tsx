interface MacroItemProps {
  label: string
  color: string
  eaten: number
  target: number
}

function MacroItem({ label, color, eaten, target }: MacroItemProps) {
  const pct = target > 0 ? Math.min(eaten / target, 1) : 0
  return (
    <div className="flex flex-col gap-[6px]">
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-2 flex-shrink-0"
          style={{ borderRadius: 3, background: color }}
        />
        <span className="text-[12.5px] font-semibold text-secondary">{label}</span>
      </div>
      <p className="tabular-nums">
        <span className="text-[15px] font-bold text-ink">{Math.round(eaten)}</span>
        <span className="text-[12px] font-medium text-muted">/{Math.round(target)}g</span>
      </p>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F1EFE9' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
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
    <div
      className="grid grid-cols-3 gap-[18px] pt-5"
      style={{ borderTop: '1px solid #F1EFE9' }}
    >
      <MacroItem label="Protein" color="#2F6FE0" eaten={proteinEaten} target={proteinTarget} />
      <MacroItem label="Carbs"   color="#E89316" eaten={carbsEaten}   target={carbsTarget}   />
      <MacroItem label="Fat"     color="#E0554D" eaten={fatEaten}     target={fatTarget}     />
    </div>
  )
}
