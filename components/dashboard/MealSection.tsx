'use client'

import type { FoodLog } from '../../types/index'
import { FoodLogItem } from './FoodLogItem'

const MEAL_ART: Record<string, { emoji: string; classes: string }> = {
  Breakfast: { emoji: '🥣', classes: 'from-amber-200 via-orange-100 to-rose-100 text-orange-700' },
  Lunch: { emoji: '🍛', classes: 'from-emerald-200 via-emerald-100 to-lime-100 text-emerald-700' },
  Dinner: { emoji: '🍲', classes: 'from-rose-200 via-pink-100 to-orange-100 text-rose-700' },
  Snacks: { emoji: '🥜', classes: 'from-yellow-200 via-amber-100 to-orange-100 text-amber-700' },
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
  const totalKcal = logs.reduce((sum, l) => sum + l.kcal, 0)

  return (
    <div className="rounded-3xl border border-gray-100 bg-white/90 p-4 space-y-2 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-3">
          <div
            className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${MEAL_ART[title]?.classes ?? 'from-gray-100 to-gray-50 text-gray-500'} flex items-end justify-end p-2 shadow-inner`}
            aria-hidden
          >
            <span className="text-lg">{MEAL_ART[title]?.emoji ?? '🍽️'}</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">{title}</h3>
            <p className="text-xs text-gray-500">{logs.length} item{logs.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        {logs.length > 0 && (
          <span className="text-xs font-semibold text-gray-500 bg-orange-50 rounded-full px-2 py-0.5 border border-orange-100">
            {Math.round(totalKcal)} kcal
          </span>
        )}
      </div>

      {logs.length === 0 ? (
        <p className="text-xs text-gray-500 py-1">Nothing logged yet</p>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <FoodLogItem key={log.id} log={log} onDelete={onDelete} isDeleting={deletingId === log.id} />
          ))}
        </div>
      )}
    </div>
  )
}
