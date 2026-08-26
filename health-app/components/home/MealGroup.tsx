import Link from 'next/link'
import { Pencil } from 'lucide-react'
import type { FoodLog } from '../../types/index'

const MEAL_CONFIG: Record<string, { label: string; letter: string }> = {
  breakfast: { label: 'Breakfast', letter: 'B' },
  lunch:     { label: 'Lunch',     letter: 'L' },
  dinner:    { label: 'Dinner',    letter: 'D' },
  snack:     { label: 'Snack',     letter: 'S' },
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}

interface Props {
  meal: string
  items: FoodLog[]
  onEdit: (log: FoodLog) => void
  onDelete: (id: string) => void
  deletingId: string | null
}

export function MealGroup({ meal, items, onEdit }: Props) {
  const cfg = MEAL_CONFIG[meal] ?? { label: meal, letter: meal[0]?.toUpperCase() ?? '?' }
  const mealKcal = Math.round(items.reduce((s, i) => s + i.kcal, 0))
  const lastLogged = items[0]?.logged_at

  return (
    <div className="rounded-card overflow-hidden bg-surface shadow-rest">
      {/* Group header */}
      <div className="flex items-center justify-between px-4 py-[14px]">
        <div className="flex items-center gap-3">
          <div className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-control bg-surface-2 text-[12px] font-semibold text-ink-2">
            {cfg.letter}
          </div>
          <div>
            <p className="text-[14px] font-semibold text-ink leading-none">{cfg.label}</p>
            {lastLogged && (
              <p className="text-[11.5px] text-ink-3 mt-[3px]">{formatTime(lastLogged)}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="block text-[14px] font-semibold text-ink tabular-nums">{mealKcal}</span>
          <span className="text-[10px] text-ink-3">kcal</span>
        </div>
      </div>

      {/* Food items */}
      <div>
        {items.map((item) => {
          const name = item.food?.name ?? 'Unknown food'
          return (
            <div key={item.id} className="flex items-center gap-3 border-t border-hairline px-4 py-3">
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium text-ink truncate leading-tight">{name}</p>
                <p className="text-[11.5px] text-ink-3 mt-[2px] truncate tabular-nums">
                  {item.grams ? `${Math.round(item.grams)}g` : `${item.servings} srv`}
                  {' · '}P {Math.round(item.protein_g)} · C {Math.round(item.carbs_g)} · F {Math.round(item.fat_g)}
                </p>
              </div>

              {/* Kcal + edit */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-[13px] font-semibold text-ink tabular-nums">
                  {Math.round(item.kcal)}
                </span>
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-[10px] bg-surface-2 tap-scale"
                  aria-label={`Edit ${name}`}
                >
                  <Pencil className="h-3.5 w-3.5 text-ink-3" strokeWidth={1.75} />
                </button>
              </div>
            </div>
          )
        })}

        {/* Add food link */}
        <div className="border-t border-hairline px-4 py-3">
          <Link
            href="/log"
            className="flex w-full items-center justify-center gap-1.5 rounded-control border border-dashed border-brand-ring py-[13px] text-[13px] font-semibold text-brand-ink tap-scale"
          >
            <span className="text-base">+</span> Add food
          </Link>
        </div>
      </div>
    </div>
  )
}
