'use client'

import { useState } from 'react'
import type { FoodLog } from '../../types/index'
import { FoodLogItem } from './FoodLogItem'
import { ChevronDown } from 'lucide-react'

const MEAL_ART: Record<string, { emoji: string; classes: string }> = {
  Breakfast: { emoji: '🥣', classes: 'from-amber-200 via-orange-100 to-rose-100 text-orange-700' },
  Lunch:     { emoji: '🍛', classes: 'from-emerald-200 via-emerald-100 to-lime-100 text-emerald-700' },
  Dinner:    { emoji: '🍲', classes: 'from-rose-200 via-pink-100 to-orange-100 text-rose-700' },
  Snacks:    { emoji: '🥜', classes: 'from-yellow-200 via-amber-100 to-orange-100 text-amber-700' },
}

export function MealSection({
  title,
  logs,
  onDelete,
  deletingId,
}: {
  title: string
  logs: FoodLog[]
  onDelete?: (id: string) => void
  deletingId?: string | null
}) {
  // Default: open when logs exist, collapsed when empty
  const [open, setOpen] = useState(logs.length > 0)

  const totalKcal = logs.reduce((sum, l) => sum + l.kcal, 0)
  const art = MEAL_ART[title] ?? { emoji: '🍽️', classes: 'from-gray-100 to-gray-50 text-gray-500' }

  return (
    <div className="rounded-3xl border border-gray-100 bg-white/90 shadow-sm overflow-hidden">
      {/* Header — always visible, click to toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 rounded-3xl"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div
            className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${art.classes} flex items-end justify-end p-2 shadow-inner flex-shrink-0`}
            aria-hidden
          >
            <span className="text-lg">{art.emoji}</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">{title}</h3>
            <p className="text-xs text-gray-500">
              {logs.length === 0
                ? 'Nothing logged yet'
                : `${logs.length} item${logs.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {logs.length > 0 && (
            <span className="text-xs font-semibold text-orange-700 bg-orange-50 rounded-full px-2.5 py-0.5 border border-orange-100">
              {Math.round(totalKcal)} kcal
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Collapsible content */}
      {open && logs.length > 0 && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-50 pt-2">
          {logs.map((log) => (
            <FoodLogItem
              key={log.id}
              log={log}
              onDelete={onDelete}
              isDeleting={deletingId === log.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
