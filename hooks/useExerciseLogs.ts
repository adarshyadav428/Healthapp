'use client'

import { useQuery } from '@tanstack/react-query'
import { getBrowserSupabaseClient } from '../lib/supabase/client'
import type { ExerciseLog } from '../types/index'
import { getUtcDayRange } from '../lib/dateUtils'

export function useExerciseLogs(userId: string | null, date = new Date(), initialData?: ExerciseLog[]) {
  const { start, end } = getUtcDayRange(date)

  return useQuery({
    queryKey: ['exercise-logs', userId, start],
    enabled: Boolean(userId),
    initialData,
    queryFn: async () => {
      if (!userId) return [] as ExerciseLog[]
      const supabase = getBrowserSupabaseClient()
      const { data, error } = await supabase
        .from('exercise_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('logged_at', start)
        .lt('logged_at', end)
        .order('logged_at', { ascending: false })

      if (error) throw new Error(error.message)
      return (data ?? []) as ExerciseLog[]
    },
  })
}
