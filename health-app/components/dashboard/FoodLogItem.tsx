 'use client'

import type { FoodLog } from '../../types/index'
import { Button } from '../ui/button'

export function FoodLogItem({ log, onDelete, isDeleting }: { log: FoodLog; onDelete?: (id: string) => void; isDeleting?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2">
      <div>
        <p className="text-sm font-medium text-gray-900">{log.food?.name ?? 'Food item'}</p>
        <p className="text-xs text-gray-500">{Math.round(log.kcal)} kcal</p>
      </div>
      {onDelete ? (
        <Button variant="ghost" onClick={() => onDelete(log.id)} disabled={isDeleting}>
          Delete
        </Button>
      ) : null}
    </div>
  )
}
