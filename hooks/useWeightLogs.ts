'use client'

import { useQuery } from '@tanstack/react-query'
import { getBrowserSupabaseClient } from '../lib/supabase/client'
import type { WeightLog } from '../types/index'

export function useWeightLogs(userId: string | null, initialData?: WeightLog[]) {
  return useQuery({
    queryKey: ['weight-logs', userId],
    enabled: Boolean(userId),
    initialData,
    queryFn: async () => {
      if (!userId) return [] as WeightLog[]
      const supabase = getBrowserSupabaseClient()
      const { data, error } = await supabase
        .from('weight_logs')
        .select('*')
        .eq('user_id', userId)
        .order('measured_at', { ascending: false })
        .limit(30)

      if (error) throw new Error(error.message)
      return (data ?? []) as WeightLog[]
    },
  })
}
