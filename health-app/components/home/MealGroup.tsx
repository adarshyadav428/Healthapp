import Link from 'next/link'
import { Pencil } from 'lucide-react'
import type { FoodLog } from '../../types/index'

const MEAL_CONFIG: Record<string, { label: string; letter: string; bg: string; color: string; time?: string }> = {
  breakfast: { label: 'Breakfast', letter: 'B', bg: '#FFF6E8', color: '#C98A2B' },
  lunch:     { label: 'Lunch',     letter: 'L', bg: '#FFF0E7', color: '#B5471A' },
  dinner:    { label: 'Dinner',    letter: 'D', bg: '#EEF4F0', color: '#3F7A5C' },
  snack:     { label: 'Snack',     letter: 'S', bg: '#EEF4F0', color: '#3F7A5C' },
}

// Deterministic color for food item badges
const BADGE_COLORS = [
  { bg: '#FFF6E8', text: '#C98A2B' },
  { bg: '#FFF0E7', text: '#B5471A' },
  { bg: '#EEF4F0', text: '#3F7A5C' },
  { bg: '#EEF0FB', text: '#4255B5' },
  { bg: '#F5EEF8', text: '#7E3FA0' },
]

function badgeColor(name: string) {
  return BADGE_COLORS[(name.charCodeAt(0) || 0) % BADGE_COLORS.length]
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

export function MealGroup({ meal, items, onEdit, onDelete, deletingId }: Props) {
  const cfg = MEAL_CONFIG[meal] ?? { label: meal, letter: meal[0]?.toUpperCase() ?? '?', bg: '#F6F4EE', color: '#6B7280' }
  const mealKcal = Math.round(items.reduce((s, i) => s + i.kcal, 0))
  const lastLogged = items[0]?.logged_at

  return (
    <div
      className="rounded-[20px] overflow-hidden bg-white"
      style={{ border: '1px solid #F1EFE9', boxShadow: '0 2px 14px rgba(20,24,29,.05)' }}
    >
      {/* Group header */}
      <div className="flex items-center justify-between px-4 py-[14px]">
        <div className="flex items-center gap-3">
          <div
            className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[11px] text-sm font-bold"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            {cfg.letter}
          </div>
          <div>
            <p className="text-[14.5px] font-semibold text-ink leading-none">{cfg.label}</p>
            {lastLogged && (
              <p className="text-[11.5px] font-medium text-muted mt-[2px]">
                {formatTime(lastLogged)}
              </p>
            )}
          </div>
        </div>
        <span className="text-[13.5px] font-semibold text-ink tabular-nums">{mealKcal} kcal</span>
      </div>

      {/* Food items */}
      <div style={{ borderTop: '1px solid #F5F3ED' }}>
        {items.map((item) => {
          const name = item.food?.name ?? 'Unknown food'
          const badge = badgeColor(name)
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderTop: '1px solid #F5F3ED' }}
            >
              {/* Badge */}
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[12px] text-sm font-bold"
                style={{ background: badge.bg, color: badge.text }}
              >
                {name[0]?.toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-ink truncate leading-tight">{name}</p>
                <p className="text-[11.5px] font-medium text-muted mt-[2px] truncate">
                  {item.grams ? `${Math.round(item.grams)}g` : `${item.servings} srv`}
                  {' · '}P {Math.round(item.protein_g)}g · C {Math.round(item.carbs_g)}g · F {Math.round(item.fat_g)}g
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
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] tap-scale"
                  style={{ background: '#F6F4EE' }}
                  aria-label={`Edit ${name}`}
                >
                  <Pencil className="h-3.5 w-3.5" style={{ color: '#9CA3AF' }} />
                </button>
              </div>
            </div>
          )
        })}

        {/* Add food link */}
        <div className="px-4 py-3" style={{ borderTop: '1px solid #F5F3ED' }}>
          <Link
            href="/log"
            className="flex items-center justify-center gap-1.5 w-full rounded-[18px] py-[15px] text-[13px] font-semibold tap-scale"
            style={{
              border: '1.5px dashed #FBDCCB',
              color: '#B5471A',
            }}
          >
            <span className="text-base font-bold">+</span> Add food
          </Link>
        </div>
      </div>
    </div>
  )
}
