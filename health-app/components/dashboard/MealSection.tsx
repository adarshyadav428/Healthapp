'use client'

import { useState } from 'react'
import type { FoodLog } from '../../types/index'
import { FoodLogItem } from './FoodLogItem'
import { ChevronDown } from 'lucide-react'

const MEAL_ART: Record<string, { emoji: string; accent: string; bg: string; border: string }> = {
  Breakfast: { emoji: '🥣', accent: 'text-orange-700 dark:text-orange-400', bg: 'from-amber-200 via-orange-100 to-rose-100', border: 'border-orange-100 dark:border-orange-900/30' },
  Lunch:     { emoji: '🍛', accent: 'text-emerald-700 dark:text-emerald-400', bg: 'from-emerald-200 via-emerald-100 to-lime-100', border: 'border-emerald-100 dark:border-emerald-900/30' },
  Dinner:    { emoji: '🍲', accent: 'text-rose-700 dark:text-rose-400', bg: 'from-rose-200 via-pink-100 to-orange-100', border: 'border-rose-100 dark:border-rose-900/30' },
  Snacks:    { emoji: '🥜', accent: 'text-amber-700 dark:text-amber-400', bg: 'from-yellow-200 via-amber-100 to-orange-100', border: 'border-amber-100 dark:border-amber-900/30' },
}

const DEFAULT_ART = { emoji: '🍽️', accent: 'text-gray-700 dark:text-slate-300', bg: 'from-gray-100 to-gray-50', border: 'border-gray-100 dark:border-slate-700' }

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
  const [open, setOpen] = useState(logs.length > 0)
  const art = MEAL_ART[title] ?? DEFAULT_ART
  const totalKcal = logs.reduce((sum, l) => sum + l.kcal, 0)

  return (
    <div className={`rounded-3xl border ${art.border} bg-white/90 dark:bg-slate-900/80 shadow-sm overflow-hidden`}>
      {/* Header — always visible, click to toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div
            className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${art.bg} flex items-end justify-end p-2 shadow-inner flex-shrink-0`}
            aria-hidden
          >
            <span className="text-lg">{art.emoji}</span>
          </div>
          <div>
            <h3 className={`text-sm font-bold ${art.accent}`}>{title}</h3>
            <p className="text-xs text-muted">
              {logs.length === 0 ? 'Nothing logged yet' : `${logs.length} item${logs.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {logs.length > 0 && (
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${art.border} ${art.accent} bg-white/60 dark:bg-slate-800/60`}>
              {Math.round(totalKcal)} kcal
            </span>
          )}
          <ChevronDown
            className={`h-4 w-4 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Collapsible body */}
      {open && logs.length > 0 && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 dark:border-slate-800 pt-2">
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
