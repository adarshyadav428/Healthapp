'use client'

import { useEffect, useMemo, useState } from 'react'
import type { FoodLog, Profile } from '../../types/index'
import { CalorieSummary } from './CalorieSummary'
import { MacroProgressBars } from './MacroProgressBars'
import { MealSection } from './MealSection'
import { StreakBadge } from './StreakBadge'
import { useFoodLogs } from '../../hooks/useFoodLogs'
import { useUser } from '../../hooks/useUser'
import { getBrowserSupabaseClient } from '../../lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../ui/use-toast'

export function DashboardClient({ profile, initialLogs, streak }: { profile: Profile; initialLogs: FoodLog[]; streak: number }) {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { data: logs = initialLogs } = useFoodLogs(user?.id ?? null, new Date(), initialLogs)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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
      <CalorieSummary kcalEaten={Math.round(totals.kcal)} kcalTarget={profile.daily_calorie_target} />
      <MacroProgressBars totals={totals} profile={profile} />
      <StreakBadge streak={streak} />

      <div className="space-y-4">
        <MealSection title="Breakfast" logs={byMeal.Breakfast} onDelete={deleteLog} deletingId={deletingId} />
        <MealSection title="Lunch" logs={byMeal.Lunch} onDelete={deleteLog} deletingId={deletingId} />
        <MealSection title="Dinner" logs={byMeal.Dinner} onDelete={deleteLog} deletingId={deletingId} />
        <MealSection title="Snacks" logs={byMeal.Snacks} onDelete={deleteLog} deletingId={deletingId} />
      </div>
    </div>
  )
}
