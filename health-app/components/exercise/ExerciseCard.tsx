'use client'

import type { ExerciseLog } from '../../types/index'
import { Button } from '../ui/button'
import { Activity, Flame, Plus } from 'lucide-react'

export function ExerciseCard({
  logs,
  onAdd,
  onDelete,
  deletingId,
  tableMissing,
}: {
  logs: ExerciseLog[]
  onAdd: () => void
  onDelete?: (id: string) => void
  deletingId?: string | null
  tableMissing?: boolean
}) {
  const totalBurned = logs.reduce((sum, log) => sum + log.calories, 0)
  const recentLogs = logs.slice(0, 3)

  return (
    <div className="rounded-3xl border border-emerald-100 dark:border-emerald-900/30 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-2xl bg-emerald-100/80 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Exercise</p>
            <div className="mt-1 flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-orange-500" />
              <p className="text-2xl font-black text-foreground">{Math.round(totalBurned)} kcal</p>
            </div>
            <p className="text-xs text-muted">Burned today</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={onAdd}
          disabled={tableMissing}
          className="h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 px-3 text-white"
        >
          <Plus className="mr-1 h-4 w-4" />
          Log
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {tableMissing ? (
          <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Enable exercise tracking</p>
            <p className="text-xs text-muted">Run the pending DB migration to store exercise logs.</p>
          </div>
        ) : recentLogs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/40 dark:bg-emerald-950/10 px-4 py-3">
            <p className="text-sm text-foreground">No exercise logged yet.</p>
            <p className="text-xs text-muted">Add a walk, workout, or yoga session.</p>
          </div>
        ) : (
          recentLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between rounded-2xl bg-white/80 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700 px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{log.activity}</p>
                <p className="text-xs text-muted">{Math.round(log.duration_min)} min</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{Math.round(log.calories)} kcal</span>
                {onDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(log.id)}
                    disabled={deletingId === log.id}
                    className="h-7 w-7 rounded-full border border-emerald-100 dark:border-emerald-900/30 text-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50 transition-colors"
                    aria-label="Delete exercise"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
