'use client'

import { useQuery } from '@tanstack/react-query'
import { getBrowserSupabaseClient } from '../lib/supabase/client'
import type { FoodLog } from '../types/index'
import { getUtcDayRange } from '../lib/dateUtils'

export function useFoodLogs(userId: string | null, date = new Date(), initialData?: FoodLog[]) {
  const { start, end } = getUtcDayRange(date)

  return useQuery({
    queryKey: ['food-logs', userId, start],
    enabled: Boolean(userId),
    initialData,
    queryFn: async () => {
      if (!userId) return [] as FoodLog[]
      const supabase = getBrowserSupabaseClient()
      const { data, error } = await supabase
        .from('food_logs')
        .select('*, food:foods(*)')
        .eq('user_id', userId)
        .gte('logged_at', start)
        .lt('logged_at', end)
        .order('logged_at', { ascending: false })

      if (error) throw new Error(error.message)
      return (data ?? []) as FoodLog[]
    },
  })
}
