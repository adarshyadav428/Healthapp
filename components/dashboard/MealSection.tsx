'use client'

import type { FoodLog } from '../../types/index'
import { FoodLogItem } from './FoodLogItem'

const MEAL_ICONS: Record<string, string> = {
  Breakfast: '🌅',
  Lunch: '☀️',
  Dinner: '🌙',
  Snacks: '🍎',
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
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <span>{MEAL_ICONS[title] ?? '🍽️'}</span>
          {title}
        </h3>
        {logs.length > 0 && (
          <span className="text-xs font-semibold text-gray-500 bg-white rounded-full px-2 py-0.5 border border-gray-200">
            {Math.round(totalKcal)} kcal
          </span>
        )}
      </div>

      {logs.length === 0 ? (
        <p className="text-xs text-gray-400 py-1">Nothing logged yet</p>
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
