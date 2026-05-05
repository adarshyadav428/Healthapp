'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FoodLog, Profile, WeightLog, ExerciseLog } from '../../types/index'
import { CalorieSummary } from './CalorieSummary'
import { MacroProgressBars } from './MacroProgressBars'
import { MealSection } from './MealSection'
import { StreakBadge } from './StreakBadge'
import { WeightTrendCard } from './WeightTrendCard'
import { WaterCard } from './WaterCard'
import { ExerciseCard } from '../exercise/ExerciseCard'
import { ExerciseLogModal } from '../exercise/ExerciseLogModal'
import { useFoodLogs } from '../../hooks/useFoodLogs'
import { useUser } from '../../hooks/useUser'
import { getBrowserSupabaseClient } from '../../lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../ui/use-toast'
import { useExerciseLogs } from '../../hooks/useExerciseLogs'

export function DashboardClient({
  profile,
  initialLogs,
  streak,
  weightLogs,
  initialExerciseLogs,
}: {
  profile: Profile
  initialLogs: FoodLog[]
  streak: number
  weightLogs: WeightLog[]
  initialExerciseLogs: ExerciseLog[]
}) {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { data: logs = initialLogs } = useFoodLogs(user?.id ?? null, new Date(), initialLogs)
  const { data: exerciseLogs = initialExerciseLogs } = useExerciseLogs(user?.id ?? null, new Date(), initialExerciseLogs)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showExerciseModal, setShowExerciseModal] = useState(false)
  const [deletingExerciseId, setDeletingExerciseId] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('upgraded') === 'true') {
      toast({ title: 'Welcome to Pro!', description: 'Your upgrade is active.' })
      params.delete('upgraded')
      const query = params.toString()
      const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  const totals = useMemo(
    () =>
      logs.reduce(
        (acc, log) => {
          acc.kcal += log.kcal
          acc.protein_g += log.protein_g
          acc.carbs_g += log.carbs_g
          acc.fat_g += log.fat_g
          return acc
        },
        { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
      ),
    [logs]
  )

  const totalBurned = useMemo(
    () => exerciseLogs.reduce((sum, log) => sum + log.calories, 0),
    [exerciseLogs]
  )

  const deleteLog = async (id: string) => {
    if (deletingId) return // prevent concurrent deletes
    try {
      setDeletingId(id)
      const supabase = getBrowserSupabaseClient()
      const { error } = await supabase.from('food_logs').delete().eq('id', id)
      if (error) throw new Error(error.message)
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      toast({ title: 'Entry deleted', description: 'Removed from your log.' })
    } catch (err) {
      toast({ title: 'Delete failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  const deleteExercise = async (id: string) => {
    if (deletingExerciseId) return
    try {
      setDeletingExerciseId(id)
      const supabase = getBrowserSupabaseClient()
      const { error } = await supabase.from('exercise_logs').delete().eq('id', id)
      if (error) throw new Error(error.message)
      queryClient.invalidateQueries({ queryKey: ['exercise-logs'] })
      toast({ title: 'Exercise deleted', description: 'Removed from your log.' })
    } catch (err) {
      toast({ title: 'Delete failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setDeletingExerciseId(null)
    }
  }

  const byMeal = useMemo(
    () => ({
      Breakfast: logs.filter((l) => l.meal === 'breakfast'),
      Lunch: logs.filter((l) => l.meal === 'lunch'),
      Dinner: logs.filter((l) => l.meal === 'dinner'),
      Snacks: logs.filter((l) => l.meal === 'snack'),
    }),
    [logs]
  )

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4">
        <div className="animate-fade-up">
          <CalorieSummary
            kcalEaten={Math.round(totals.kcal)}
            kcalBurned={Math.round(totalBurned)}
            kcalTarget={profile.daily_calorie_target}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="animate-fade-up" style={{ animationDelay: '80ms' }}>
            <StreakBadge streak={streak} />
          </div>
          <div className="animate-fade-up" style={{ animationDelay: '140ms' }}>
            <WeightTrendCard logs={weightLogs} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="animate-fade-up" style={{ animationDelay: '200ms' }}>
          <div className="rounded-3xl border border-amber-100 bg-white/90 p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Macros</p>
              <p className="mt-1 text-sm text-gray-500">Keep your balance today</p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-amber-100/80 flex items-center justify-center text-amber-700">
              🧭
            </div>
          </div>
          <div className="mt-4">
            <MacroProgressBars totals={totals} profile={profile} />
          </div>
          </div>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: '260ms' }}>
          <WaterCard />
        </div>
      </section>

      <section className="grid gap-4">
        <div className="animate-fade-up" style={{ animationDelay: '320ms' }}>
          <ExerciseCard
            logs={exerciseLogs}
            onAdd={() => setShowExerciseModal(true)}
            onDelete={deleteExercise}
            deletingId={deletingExerciseId}
          />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Meals</p>
          <span className="text-xs text-gray-400">Today</span>
        </div>
        <MealSection title="Breakfast" logs={byMeal.Breakfast} onDelete={deleteLog} deletingId={deletingId} />
        <MealSection title="Lunch" logs={byMeal.Lunch} onDelete={deleteLog} deletingId={deletingId} />
        <MealSection title="Dinner" logs={byMeal.Dinner} onDelete={deleteLog} deletingId={deletingId} />
        <MealSection title="Snacks" logs={byMeal.Snacks} onDelete={deleteLog} deletingId={deletingId} />
      </section>

      {showExerciseModal ? <ExerciseLogModal onClose={() => setShowExerciseModal(false)} /> : null}
    </div>
  )
}
