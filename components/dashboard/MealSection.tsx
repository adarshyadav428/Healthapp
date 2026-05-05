 'use client'

import type { FoodLog } from '../../types/index'
import { FoodLogItem } from './FoodLogItem'

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
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      {logs.length === 0 ? (
        <p className="text-sm text-gray-500">No entries yet.</p>
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
