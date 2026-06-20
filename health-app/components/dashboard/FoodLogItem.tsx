'use client'

import type { FoodLog } from '../../types/index'
import { Button } from '../ui/button'
import { Trash2 } from 'lucide-react'

export function FoodLogItem({ log, onDelete, isDeleting }: { log: FoodLog; onDelete?: (id: string) => void; isDeleting?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800/60 px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex-1 min-w-0 mr-3">
        <p className="text-sm font-semibold text-foreground truncate">{log.food?.name ?? (log.food_id == null ? 'Quick Add' : 'Food item')}</p>
        <div className="flex gap-3 mt-1 flex-wrap">
          <Macro value={Math.round(log.kcal)}      unit="kcal" color="text-gray-700 dark:text-slate-300 font-medium" />
          <Macro value={Math.round(log.protein_g)} unit="P"    color="text-blue-600 dark:text-blue-400" />
          <Macro value={Math.round(log.carbs_g)}   unit="C"    color="text-amber-600 dark:text-amber-400" />
          <Macro value={Math.round(log.fat_g)}     unit="F"    color="text-rose-500 dark:text-rose-400" />
        </div>
      </div>
      {onDelete && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 flex-shrink-0 transition-transform active:scale-95"
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
    <span className={`text-xs ${color}`}>{value}{unit}</span>
  )
}
