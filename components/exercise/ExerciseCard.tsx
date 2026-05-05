'use client'

import type { ExerciseLog } from '../../types/index'
import { Button } from '../ui/button'
import { Activity, Flame, Plus } from 'lucide-react'

export function ExerciseCard({
  logs,
  onAdd,
  onDelete,
  deletingId,
}: {
  logs: ExerciseLog[]
  onAdd: () => void
  onDelete?: (id: string) => void
  deletingId?: string | null
}) {
  const totalBurned = logs.reduce((sum, log) => sum + log.calories, 0)
  const recentLogs = logs.slice(0, 3)

  return (
    <div className="rounded-3xl border border-emerald-100 bg-white/90 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-2xl bg-emerald-100/80 flex items-center justify-center text-emerald-700">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Exercise</p>
            <div className="mt-1 flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <p className="text-2xl font-black text-gray-900">{Math.round(totalBurned)} kcal</p>
            </div>
            <p className="text-xs text-gray-500">Burned today</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={onAdd}
          className="h-9 rounded-full bg-emerald-600 px-3 text-white hover:bg-emerald-700"
        >
          <Plus className="mr-1 h-4 w-4" />
          Log
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {recentLogs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-emerald-100 bg-emerald-50/40 px-4 py-3">
            <p className="text-sm text-gray-600">No exercise logged yet.</p>
            <p className="text-xs text-gray-500">Add a walk, workout, or yoga session.</p>
          </div>
        ) : (
          recentLogs.map((log) => (
            <div key={log.id} className="flex items-center justify-between rounded-2xl bg-white/80 px-3 py-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">{log.activity}</p>
                <p className="text-xs text-gray-500">{Math.round(log.duration_min)} min</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-emerald-600">{Math.round(log.calories)} kcal</span>
                {onDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(log.id)}
                    disabled={deletingId === log.id}
                    className="h-7 w-7 rounded-full border border-emerald-100 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
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
