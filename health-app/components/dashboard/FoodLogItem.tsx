'use client'

import type { FoodLog } from '../../types/index'
import { Button } from '../ui/button'
import { Trash2 } from 'lucide-react'

export function FoodLogItem({ log, onDelete, isDeleting }: { log: FoodLog; onDelete?: (id: string) => void; isDeleting?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-control border border-hairline bg-surface px-4 py-3 shadow-rest transition-all duration-150 hover:-translate-y-0.5 hover:shadow-float">
      <div className="flex-1 min-w-0 mr-3">
        <p className="text-sm font-semibold text-ink truncate">{log.food?.name ?? (log.food_id == null ? 'Quick Add' : 'Food item')}</p>
        <div className="flex gap-3 mt-1 flex-wrap">
          <Macro value={Math.round(log.kcal)}      unit="kcal" color="var(--ink-2)" />
          <Macro value={Math.round(log.protein_g)} unit="P"    color="var(--protein)" />
          <Macro value={Math.round(log.carbs_g)}   unit="C"    color="var(--carbs)" />
          <Macro value={Math.round(log.fat_g)}     unit="F"    color="var(--fat)" />
        </div>
      </div>
      {onDelete && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 text-ink-2 hover:text-danger hover:bg-danger-soft flex-shrink-0 transition-transform active:scale-95"
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
    <span className="text-xs font-medium tabular-nums" style={{ color }}>{value}{unit}</span>
  )
}
