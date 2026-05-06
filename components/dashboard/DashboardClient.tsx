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
import { DailyInsight } from './DailyInsight'
import { WeeklySummary } from './WeeklySummary'
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
  weekLogs,
}: {
  profile: Profile
  initialLogs: FoodLog[]
  streak: number
  weightLogs: WeightLog[]
  initialExerciseLogs: ExerciseLog[]
  weekLogs: { kcal: number; logged_at: string }[]
}) {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { data: logs = initialLogs } = useFoodLogs(user?.id ?? null, new Date(), initialLogs)
  const exerciseQuery = useExerciseLogs(user?.id ?? null, new Date(), initialExerciseLogs)
  const exerciseLogs = exerciseQuery.data?.logs ?? initialExerciseLogs
  const exerciseTableMissing = exerciseQuery.data?.tableMissing ?? false
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showExerciseModal, setShowExerciseModal] = useState(false)
  const [deletingExerciseId, setDeletingExerciseId] = useState<string | null>(null)

  // Upgraded toast on first render
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('upgraded') === 'true') {
      toast({ title: 'Welcome to Pro! 🎉', description: 'Your upgrade is active. Enjoy unlimited tracking.' })
      params.delete('upgraded')
      const query = params.toString()
      window.history.replaceState({}, '', query ? `${window.location.pathname}?${query}` : window.location.pathname)
    }
  }, [])

  // Streak milestone celebrations — fire once per milestone
  useEffect(() => {
    const MILESTONES: Record<number, { title: string; description: string }> = {
      7:   { title: '🔥 7-Day Streak!',  description: "One week strong! You're building a real habit." },
      14:  { title: '🚀 14-Day Streak!', description: 'Two weeks consistent — your body thanks you!' },
      30:  { title: '🏆 30-Day Streak!', description: "A whole month! You're unstoppable." },
      60:  { title: '💎 60-Day Streak!', description: 'Two months in — this is your lifestyle now.' },
      100: { title: '👑 100-Day Streak!', description: 'Legendary. You are the 1%.' },
    }
    if (!MILESTONES[streak]) return
    const key = `streak_celebrated_${streak}`
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    setTimeout(() => toast({ ...MILESTONES[streak], duration: 6000 }), 800)
  }, [streak])

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
    if (deletingId) return
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
      Lunch:     logs.filter((l) => l.meal === 'lunch'),
      Dinner:    logs.filter((l) => l.meal === 'dinner'),
      Snacks:    logs.filter((l) => l.meal === 'snack'),
    }),
    [logs]
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Calorie ring */}
      <div className="animate-fade-up">
        <CalorieSummary
          kcalEaten={Math.round(totals.kcal)}
          kcalBurned={Math.round(totalBurned)}
          kcalTarget={profile.daily_calorie_target}
        />
      </div>

      {/* Streak + weight trend */}
      <div className="grid grid-cols-2 gap-3 animate-fade-up" style={{ animationDelay: '80ms' }}>
        <StreakBadge streak={streak} />
        <WeightTrendCard logs={weightLogs} />
      </div>

      {/* Daily insight */}
      <div className="animate-fade-up" style={{ animationDelay: '140ms' }}>
        <DailyInsight totals={totals} profile={profile} />
      </div>

      {/* Weekly summary */}
      <div className="animate-fade-up" style={{ animationDelay: '170ms' }}>
        <WeeklySummary weekLogs={weekLogs} kcalTarget={profile.daily_calorie_target} />
      </div>

      {/* Macros + Water */}
      <div className="grid grid-cols-2 gap-3 animate-fade-up" style={{ animationDelay: '210ms' }}>
        {/* Macros card */}
        <div className="rounded-3xl border border-amber-100 bg-white/90 p-4 shadow-sm dark:border-amber-900/30 dark:bg-slate-900/90">
          <div className="flex items-start justify-between mb-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Macros</p>
            <span className="text-base">🧭</span>
          </div>
          <MacroProgressBars totals={totals} profile={profile} />
        </div>
        {/* Water card */}
        <WaterCard targetMl={profile.water_target_ml ?? 2500} />
      </div>

      {/* Exercise */}
      <div className="animate-fade-up" style={{ animationDelay: '260ms' }}>
        <ExerciseCard
          logs={exerciseLogs}
          onAdd={() => setShowExerciseModal(true)}
          onDelete={deleteExercise}
          deletingId={deletingExerciseId}
          tableMissing={exerciseTableMissing}
        />
      </div>

      {/* Meal sections */}
      <div className="space-y-3 animate-fade-up" style={{ animationDelay: '310ms' }}>
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Meals</p>
          <span className="text-xs text-muted">Today</span>
        </div>
        <MealSection title="Breakfast" logs={byMeal.Breakfast} onDelete={deleteLog} deletingId={deletingId} />
        <MealSection title="Lunch"     logs={byMeal.Lunch}     onDelete={deleteLog} deletingId={deletingId} />
        <MealSection title="Dinner"    logs={byMeal.Dinner}    onDelete={deleteLog} deletingId={deletingId} />
        <MealSection title="Snacks"    logs={byMeal.Snacks}    onDelete={deleteLog} deletingId={deletingId} />
      </div>

      {showExerciseModal && !exerciseTableMissing ? (
        <ExerciseLogModal onClose={() => setShowExerciseModal(false)} bodyWeightKg={profile.current_weight_kg} />
      ) : null}
    </div>
  )
}
