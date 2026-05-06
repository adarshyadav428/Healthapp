'use client'

import { useQuery } from '@tanstack/react-query'
import { getBrowserSupabaseClient } from '../lib/supabase/client'
import type { ExerciseLog } from '../types/index'
import { getUtcDayRange } from '../lib/dateUtils'

const MISSING_TABLE_RE = /exercise_logs/i

type ExerciseQueryResult = {
  logs: ExerciseLog[]
  tableMissing: boolean
}

export function useExerciseLogs(userId: string | null, date = new Date(), initialData?: ExerciseLog[]) {
  const { start, end } = getUtcDayRange(date)

  return useQuery<ExerciseQueryResult>({
    queryKey: ['exercise-logs', userId, start],
    enabled: Boolean(userId),
    initialData: initialData ? { logs: initialData, tableMissing: false } : undefined,
    queryFn: async () => {
      if (!userId) return { logs: [], tableMissing: false }
      const supabase = getBrowserSupabaseClient()
      const { data, error } = await supabase
        .from('exercise_logs')
        .select('id, activity, duration_min, calories, logged_at, created_at')
        .eq('user_id', userId)
        .gte('logged_at', start)
        .lt('logged_at', end)
        .order('logged_at', { ascending: false })

      if (error) {
        if (MISSING_TABLE_RE.test(error.message)) return { logs: [], tableMissing: true }
        throw new Error(error.message)
      }
      return { logs: (data ?? []) as ExerciseLog[], tableMissing: false }
    },
  })
}
