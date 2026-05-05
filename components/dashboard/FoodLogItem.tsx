'use client'

import type { FoodLog } from '../../types/index'
import { Button } from '../ui/button'
import { Trash2 } from 'lucide-react'

export function FoodLogItem({ log, onDelete, isDeleting }: { log: FoodLog; onDelete?: (id: string) => void; isDeleting?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex-1 min-w-0 mr-3">
        <p className="text-sm font-semibold text-gray-900 truncate">{log.food?.name ?? 'Food item'}</p>
        <div className="flex gap-3 mt-1 flex-wrap">
          <Macro value={Math.round(log.kcal)} unit="kcal" color="text-gray-700 font-medium" />
          <Macro value={Math.round(log.protein_g)} unit="P" color="text-emerald-600" />
          <Macro value={Math.round(log.carbs_g)} unit="C" color="text-amber-600" />
          <Macro value={Math.round(log.fat_g)} unit="F" color="text-rose-500" />
        </div>
      </div>
      {onDelete && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 flex-shrink-0 transition-transform active:scale-95"
          onClick={() => onDelete(log.id)}
          disabled={isDeleting}
          aria-label="Delete food entry"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

function Macro({ value, unit, color }: { value: number; unit: string; color: string }) {
  return (
    <span className={`text-xs ${color}`}>
      {value}{unit}
    </span>
  )
}
