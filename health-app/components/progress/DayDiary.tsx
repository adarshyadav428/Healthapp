'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { FoodLog, ExerciseLog } from '../../types/index'
import { getIstDayRange } from '../../lib/dateUtils'
import { isLiquidFood } from '../../lib/portion-units'
import { Dumbbell, Pencil, Trash2 } from 'lucide-react'
import { IconButton } from '../ui/IconButton'
import { toast } from '../ui/use-toast'
import { EditFoodLogModal } from '../log/EditFoodLogModal'
import { ShareDayButton } from '../log/ShareDayButton'
import { ProLock } from '../ui/ProLock'

// Meal groups in reading order. Labels are ink, not a colour per meal — the
// same row idiom as Home's "Today's meals" and the Food log.
const MEAL_CONFIG = {
  breakfast: { label: 'Breakfast' },
  lunch: { label: 'Lunch' },
  dinner: { label: 'Dinner' },
  snack: { label: 'Snack' },
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
  { userId, date, firstName, beyondFreeWindow = false, freeHistoryDays }: {
    userId: string
    date: Date
    firstName?: string | null
    /** The selected day is older than the free history window — the API clamped
     *  it away, so an empty result means "Pro", not "nothing logged". */
    beyondFreeWindow?: boolean
    /** The account's cohort window (lib/freeTier.ts), so the lock card can name
     *  the real number. Hardcoding "7" here told post-cutoff accounts — who get
     *  5 — the wrong thing at the exact moment they hit the gate. */
    freeHistoryDays?: number
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
      <div className="space-y-2 py-1" aria-busy="true">
        <div className="h-6 w-40 animate-shimmer rounded bg-surface-2" />
        <div className="h-11 animate-shimmer rounded-control bg-surface-2" />
        <div className="h-11 animate-shimmer rounded-control bg-surface-2" />
      </div>
    )
  }

  if (!logs || logs.length === 0) {
    if (beyondFreeWindow) {
      return (
        <ProLock.Card
          reason="history"
          title="This day is beyond your free history"
          body={`${freeHistoryDays ? `Free shows the last ${freeHistoryDays} days in full.` : 'Free shows your recent diary.'} Pro opens every day you've ever logged — search back to any date.`}
          cta="See what Pro adds"
        />
      )
    }
    return <p className="py-4 text-center text-body text-ink-2">Nothing logged on this day.</p>
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
    <div>
      {/* Day total — the numeral and the three macros, the way every other
          surface says it. */}
      <p className="flex items-baseline gap-1.5">
        <span className="font-display text-title-lg font-semibold tabular-nums leading-none text-ink">{Math.round(totalKcal).toLocaleString('en-IN')}</span>
        <span className="text-caption text-ink-2">kcal</span>
      </p>
      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-caption">
        {([['Protein', totalP, 'var(--protein)'], ['Carbs', totalC, 'var(--carbs)'], ['Fat', totalF, 'var(--fat)']] as const).map(([label, g, color]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden="true" />
            <dt className="text-ink-2">{label}</dt>
            <dd className="font-semibold tabular-nums text-ink">{Math.round(g)} g</dd>
          </div>
        ))}
      </dl>

      {/* Meals — a heading and hairline rows per group, no card in a card. */}
      {(Object.entries(byMeal) as [keyof typeof MEAL_CONFIG, FoodLog[]][])
        .filter(([, items]) => items.length > 0)
        .map(([meal, items]) => {
          const mealKcal = items.reduce((s, l) => s + l.kcal, 0)
          return (
            <section key={meal} aria-label={MEAL_CONFIG[meal].label} className="mt-4">
              <div className="flex items-baseline justify-between">
                <h3 className="text-body font-semibold text-ink">{MEAL_CONFIG[meal].label}</h3>
                <span className="text-caption tabular-nums text-ink-3">{Math.round(mealKcal)} kcal</span>
              </div>
              <ul className="mt-1 divide-y divide-hairline">
                {items.map((log) => (
                  <li key={log.id} className="flex min-h-[52px] items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-medium text-ink">{log.food?.name ?? 'Food item'}</p>
                      <p className="text-caption tabular-nums text-ink-3">{Math.round(log.grams)}{log.food?.name && isLiquidFood(log.food.name) ? ' ml' : ' g'} · P {Math.round(log.protein_g)} · C {Math.round(log.carbs_g)} · F {Math.round(log.fat_g)}</p>
                    </div>
                    <span className="shrink-0 text-body font-semibold tabular-nums text-ink">{Math.round(log.kcal)}</span>
                    <div className="flex shrink-0 items-center">
                      <IconButton label={`Edit ${log.food?.name ?? 'entry'}`} onClick={() => setEditingLog(log)} className="text-ink-2 hover:bg-surface-2 hover:text-ink">
                        <Pencil className="h-4 w-4" strokeWidth={1.75} />
                      </IconButton>
                      <IconButton label={`Delete ${log.food?.name ?? 'entry'}`} onClick={() => deleteLog(log.id)} disabled={deletingId === log.id} className="text-ink-2 hover:bg-danger-soft hover:text-danger disabled:opacity-40">
                        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                      </IconButton>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}

      <div className="mt-4">
        <ShareDayButton logs={logs} date={date} firstName={firstName} />
      </div>

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
        <section aria-label="Exercise" className="mt-4">
          <div className="flex items-baseline justify-between">
            <h3 className="flex items-center gap-1.5 text-body font-semibold text-ink">
              <Dumbbell className="h-4 w-4 text-ink-2" strokeWidth={1.75} /> Exercise
            </h3>
            <span className="text-caption tabular-nums text-ink-3">
              −{exerciseLogs.reduce((s, e) => s + e.calories, 0)} kcal burned
            </span>
          </div>
          <ul className="mt-1 divide-y divide-hairline">
            {exerciseLogs.map((log) => (
              <li key={log.id} className="flex min-h-[52px] items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium capitalize text-ink">{log.activity}</p>
                  <p className="text-caption text-ink-3">{log.duration_min} min</p>
                </div>
                <span className="shrink-0 text-body font-semibold tabular-nums text-ink">−{log.calories}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
