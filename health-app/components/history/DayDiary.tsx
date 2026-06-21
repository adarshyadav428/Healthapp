'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getBrowserSupabaseClient } from '../../lib/supabase/client'
import type { FoodLog, ExerciseLog } from '../../types/index'
import { getUtcDayRange } from '../../lib/dateUtils'
import { Loader2, Dumbbell, Flame, Pencil, Trash2 } from 'lucide-react'
import { toast } from '../ui/use-toast'
import { EditFoodLogModal } from '../log/EditFoodLogModal'

const MEAL_CONFIG = {
  breakfast: { emoji: '🥣', label: 'Breakfast', color: 'text-amber-700' },
  lunch: { emoji: '🍛', label: 'Lunch', color: 'text-emerald-700' },
  dinner: { emoji: '🍲', label: 'Dinner', color: 'text-rose-700' },
  snack: { emoji: '🥜', label: 'Snack', color: 'text-amber-600' },
}

function useDayLogs(userId: string | null, date: Date) {
  const { start, end } = getUtcDayRange(date)
  return useQuery({
    queryKey: ['food-logs-diary', userId, start],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return [] as FoodLog[]
      const supabase = getBrowserSupabaseClient()
      const { data, error } = await supabase
        .from('food_logs')
        .select('*, food:foods(name, brand)')
        .eq('user_id', userId)
        .gte('logged_at', start)
        .lt('logged_at', end)
        .order('logged_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as FoodLog[]
    },
  })
}

function useDayExercise(userId: string | null, date: Date) {
  const { start, end } = getUtcDayRange(date)
  return useQuery({
    queryKey: ['exercise-logs-diary', userId, start],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return [] as ExerciseLog[]
      const supabase = getBrowserSupabaseClient()
      const { data, error } = await supabase
        .from('exercise_logs')
        .select('id, activity, duration_min, calories, logged_at')
        .eq('user_id', userId)
        .gte('logged_at', start)
        .lt('logged_at', end)
        .order('logged_at', { ascending: true })
      if (error) return [] as ExerciseLog[] // table may not exist yet
      return (data ?? []) as ExerciseLog[]
    },
  })
}

export function DayDiary({ userId, date }: { userId: string; date: Date }) {
  const { data: logs, isLoading } = useDayLogs(userId, date)
  const { data: exerciseLogs = [] } = useDayExercise(userId, date)
  const queryClient = useQueryClient()
  const [editingLog, setEditingLog] = useState<FoodLog | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { start } = getUtcDayRange(date)

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
        <Loader2 className="h-5 w-5 animate-spin text-orange-400" />
      </div>
    )
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-2xl mb-1">🍽️</p>
        <p className="text-sm text-muted">Nothing logged on this day.</p>
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
        <div className="rounded-xl bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/30 px-3 py-1.5 text-center">
          <p className="text-sm font-black text-orange-700 dark:text-orange-400">{Math.round(totalKcal)}</p>
          <p className="text-[10px] text-orange-500 dark:text-orange-400">kcal</p>
        </div>
        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/30 px-3 py-1.5 text-center">
          <p className="text-sm font-black text-blue-700 dark:text-blue-400">{Math.round(totalP)}g</p>
          <p className="text-[10px] text-blue-500 dark:text-blue-400">protein</p>
        </div>
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 px-3 py-1.5 text-center">
          <p className="text-sm font-black text-amber-700 dark:text-amber-400">{Math.round(totalC)}g</p>
          <p className="text-[10px] text-amber-500 dark:text-amber-400">carbs</p>
        </div>
        <div className="rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 px-3 py-1.5 text-center">
          <p className="text-sm font-black text-rose-700 dark:text-rose-400">{Math.round(totalF)}g</p>
          <p className="text-[10px] text-rose-500 dark:text-rose-400">fat</p>
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
                <span className="text-[11px] text-muted font-medium">{Math.round(mealKcal)} kcal</span>
              </div>
              <div className="space-y-1.5">
                {items.map((log) => (
                  <div key={log.id} className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-3 py-2">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="text-xs font-semibold text-foreground truncate">{log.food?.name ?? 'Food item'}</p>
                      <p className="text-[10px] text-muted">{Math.round(log.grams)}g · {Math.round(log.protein_g)}P {Math.round(log.carbs_g)}C {Math.round(log.fat_g)}F</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs font-bold text-foreground mr-1">{Math.round(log.kcal)} kcal</span>
                      <button
                        type="button"
                        onClick={() => setEditingLog(log)}
                        className="rounded-full p-1 text-muted hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLog(log.id)}
                        disabled={deletingId === log.id}
                        className="rounded-full p-1 text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-40 transition-colors"
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

      {editingLog && (
        <EditFoodLogModal
          log={editingLog}
          onClose={() => setEditingLog(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['food-logs-diary', userId, start] })}
        />
      )}

      {/* Exercise for the day */}
      {exerciseLogs.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Dumbbell className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            <span className="text-xs font-bold text-violet-700 dark:text-violet-400">Exercise</span>
            <span className="text-[11px] text-muted font-medium ml-auto">
              −{exerciseLogs.reduce((s, e) => s + e.calories, 0)} kcal burned
            </span>
          </div>
          <div className="space-y-1.5">
            {exerciseLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-xl bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Flame className="h-3 w-3 text-orange-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground capitalize truncate">{log.activity}</p>
                    <p className="text-[10px] text-muted">{log.duration_min} min</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-violet-700 dark:text-violet-400 shrink-0">{log.calories} kcal</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
