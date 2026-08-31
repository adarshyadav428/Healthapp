'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { FoodLog, ExerciseLog } from '../../types/index'
import { getIstDayRange } from '../../lib/dateUtils'
import { isLiquidFood } from '../../lib/portion-units'
import { Loader2, Dumbbell, Flame, Pencil, Trash2 } from 'lucide-react'
import { toast } from '../ui/use-toast'
import { EditFoodLogModal } from '../log/EditFoodLogModal'
import { ShareDayButton } from '../log/ShareDayButton'
import { ProLock } from '../ui/ProLock'

const MEAL_CONFIG = {
  breakfast: { emoji: '🥣', label: 'Breakfast', color: 'text-energy-ink' },
  lunch: { emoji: '🍛', label: 'Lunch', color: 'text-good' },
  dinner: { emoji: '🍲', label: 'Dinner', color: 'text-brand-ink' },
  snack: { emoji: '🥜', label: 'Snack', color: 'text-energy-ink' },
}

// Both hooks go through the server API (not the browser Supabase client) so
// the free-tier 7-day history clamp is enforced server-side for every read.
function useDayLogs(userId: string | null, date: Date) {
  const { start, end } = getIstDayRange(date)
  return useQuery({
    queryKey: ['food-logs-diary', userId, start],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return [] as FoodLog[]
      const params = new URLSearchParams({ start, end })
      const res = await fetch(`/api/logs?${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to fetch day logs')
      }
      const data = (await res.json()) as FoodLog[]
      // API returns newest-first; the diary reads top-to-bottom through the day
      return data.slice().sort((a, b) => a.logged_at.localeCompare(b.logged_at))
    },
  })
}

function useDayExercise(userId: string | null, date: Date) {
  const { start, end } = getIstDayRange(date)
  return useQuery({
    queryKey: ['exercise-logs-diary', userId, start],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return [] as ExerciseLog[]
      const params = new URLSearchParams({ start, end })
      const res = await fetch(`/api/exercise/logs?${params}`)
      if (!res.ok) return [] as ExerciseLog[]
      return (await res.json()) as ExerciseLog[]
    },
  })
}

export function DayDiary(
  { userId, date, firstName, beyondFreeWindow = false }: {
    userId: string
    date: Date
    firstName?: string | null
    /** The selected day is older than the free history window — the API clamped
     *  it away, so an empty result means "Pro", not "nothing logged". */
    beyondFreeWindow?: boolean
  }
) {
  const { data: logs, isLoading } = useDayLogs(userId, date)
  const { data: exerciseLogs = [] } = useDayExercise(userId, date)
  const queryClient = useQueryClient()
  const [editingLog, setEditingLog] = useState<FoodLog | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { start } = getIstDayRange(date)

  const deleteLog = async (id: string) => {
    if (deletingId) return
    setDeletingId(id)
    try {
      const res = await fetch('/api/logs/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Delete failed')
      queryClient.setQueryData<FoodLog[]>(['food-logs-diary', userId, start], (old = []) => old.filter(f => f.id !== id))
      toast({ title: 'Entry deleted', duration: 2000 })
    } catch (err) {
      toast({ title: 'Delete failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-brand" />
      </div>
    )
  }

  if (!logs || logs.length === 0) {
    if (beyondFreeWindow) {
      return (
        <ProLock.Card
          reason="history"
          title="This day is beyond your free history"
          body="Free shows the last 7 days in full. Pro opens every day you've ever logged — search back to any date."
          cta="See what Pro adds"
        />
      )
    }
    return (
      <div className="py-6 text-center">
        <p className="text-2xl mb-1">🍽️</p>
        <p className="text-sm text-ink-2">Nothing logged on this day.</p>
      </div>
    )
  }

  const byMeal = (Object.keys(MEAL_CONFIG) as (keyof typeof MEAL_CONFIG)[]).reduce((acc, meal) => {
    acc[meal] = logs.filter((l) => l.meal === meal)
    return acc
  }, {} as Record<keyof typeof MEAL_CONFIG, FoodLog[]>)

  const totalKcal = logs.reduce((s, l) => s + l.kcal, 0)
  const totalP = logs.reduce((s, l) => s + l.protein_g, 0)
  const totalC = logs.reduce((s, l) => s + l.carbs_g, 0)
  const totalF = logs.reduce((s, l) => s + l.fat_g, 0)

  return (
    <div className="space-y-3">
      {/* Day total */}
      <div className="flex gap-2 flex-wrap">
        <div className="rounded-control bg-energy-soft border border-hairline px-3 py-1.5 text-center">
          <p className="text-sm font-bold text-energy-ink tabular-nums">{Math.round(totalKcal)}</p>
          <p className="text-[10px] text-energy-ink opacity-80">kcal</p>
        </div>
        <div className="rounded-control border border-hairline px-3 py-1.5 text-center" style={{ background: 'color-mix(in srgb, var(--protein) 8%, transparent)' }}>
          <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--protein)' }}>{Math.round(totalP)}g</p>
          <p className="text-[10px] opacity-80" style={{ color: 'var(--protein)' }}>protein</p>
        </div>
        <div className="rounded-control border border-hairline px-3 py-1.5 text-center" style={{ background: 'color-mix(in srgb, var(--carbs) 10%, transparent)' }}>
          <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--carbs)' }}>{Math.round(totalC)}g</p>
          <p className="text-[10px] opacity-80" style={{ color: 'var(--carbs)' }}>carbs</p>
        </div>
        <div className="rounded-control border border-hairline px-3 py-1.5 text-center" style={{ background: 'color-mix(in srgb, var(--fat) 10%, transparent)' }}>
          <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--fat)' }}>{Math.round(totalF)}g</p>
          <p className="text-[10px] opacity-80" style={{ color: 'var(--fat)' }}>fat</p>
        </div>
      </div>

      {/* Meals */}
      {(Object.entries(byMeal) as [keyof typeof MEAL_CONFIG, FoodLog[]][])
        .filter(([, items]) => items.length > 0)
        .map(([meal, items]) => {
          const cfg = MEAL_CONFIG[meal]
          const mealKcal = items.reduce((s, l) => s + l.kcal, 0)
          return (
            <div key={meal}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span>{cfg.emoji}</span>
                  <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                </div>
                <span className="text-[11px] text-ink-2 font-medium tabular-nums">{Math.round(mealKcal)} kcal</span>
              </div>
              <div className="space-y-1.5">
                {items.map((log) => (
                  <div key={log.id} className="flex items-center justify-between rounded-control bg-surface-2 border border-hairline px-3 py-2">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="text-xs font-semibold text-ink truncate">{log.food?.name ?? 'Food item'}</p>
                      <p className="text-[10px] text-ink-2 tabular-nums">{Math.round(log.grams)}{log.food?.name && isLiquidFood(log.food.name) ? 'ml' : 'g'} · {Math.round(log.protein_g)}P {Math.round(log.carbs_g)}C {Math.round(log.fat_g)}F</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs font-bold text-ink mr-1 tabular-nums">{Math.round(log.kcal)} kcal</span>
                      <button
                        type="button"
                        onClick={() => setEditingLog(log)}
                        className="rounded-full p-1 text-ink-2 hover:text-brand hover:bg-brand-soft transition-colors"
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLog(log.id)}
                        disabled={deletingId === log.id}
                        className="rounded-full p-1 text-ink-2 hover:text-danger hover:bg-danger-soft disabled:opacity-40 transition-colors"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

      <ShareDayButton logs={logs} date={date} firstName={firstName} />

      {editingLog && (
        <EditFoodLogModal
          log={editingLog}
          onClose={() => setEditingLog(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['food-logs-diary', userId, start] })}
          logDate={date}
        />
      )}

      {/* Exercise for the day */}
      {exerciseLogs.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Dumbbell className="h-3.5 w-3.5 text-brand" />
            <span className="text-xs font-bold text-brand-ink">Exercise</span>
            <span className="text-[11px] text-ink-2 font-medium ml-auto tabular-nums">
              −{exerciseLogs.reduce((s, e) => s + e.calories, 0)} kcal burned
            </span>
          </div>
          <div className="space-y-1.5">
            {exerciseLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-control bg-brand-soft border border-hairline px-3 py-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Flame className="h-3 w-3 shrink-0" style={{ color: 'var(--fat)' }} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink capitalize truncate">{log.activity}</p>
                    <p className="text-[10px] text-ink-2">{log.duration_min} min</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-brand-ink shrink-0 tabular-nums">{log.calories} kcal</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
