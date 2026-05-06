'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getBrowserSupabaseClient } from '../lib/supabase/client'
import { getUtcDayRange } from '../lib/dateUtils'
import type { WaterLog } from '../types/index'
import { toast } from '../components/ui/use-toast'

const MISSING_TABLE_RE = /water_logs/i

type WaterQueryResult = {
  logs: WaterLog[]
  tableMissing: boolean
}

export function useWaterLogs(userId: string | null, date = new Date()) {
  const { start, end } = getUtcDayRange(date)
  const queryClient = useQueryClient()

  const query = useQuery<WaterQueryResult>({
    queryKey: ['water-logs', userId, start],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return { logs: [], tableMissing: false }
      const supabase = getBrowserSupabaseClient()
      const { data, error } = await supabase
        .from('water_logs')
        .select('id, user_id, ml, logged_at, created_at')
        .eq('user_id', userId)
        .gte('logged_at', start)
        .lt('logged_at', end)
        .order('logged_at', { ascending: false })

      if (error) {
        if (MISSING_TABLE_RE.test(error.message)) {
          return { logs: [], tableMissing: true }
        }
        throw new Error(error.message)
      }

      return { logs: (data ?? []) as WaterLog[], tableMissing: false }
    },
  })

  const totalMl = (query.data?.logs ?? []).reduce((sum, log) => sum + Number(log.ml), 0)
  const latestId = query.data?.logs?.[0]?.id ?? null

  const add = async (amount: number) => {
    if (!userId || amount <= 0 || query.data?.tableMissing) return
    try {
      const supabase = getBrowserSupabaseClient()
      const { error } = await supabase.from('water_logs').insert({
        user_id: userId,
        ml: amount,
        logged_at: new Date().toISOString(),
      })
      if (error) throw new Error(error.message)
      queryClient.invalidateQueries({ queryKey: ['water-logs', userId, start] })
    } catch (err) {
      toast({ title: 'Water log failed', description: (err as Error).message, variant: 'error' })
    }
  }

  const undo = async () => {
    if (!userId || !latestId || query.data?.tableMissing) return
    try {
      const supabase = getBrowserSupabaseClient()
      const { error } = await supabase.from('water_logs').delete().eq('id', latestId)
      if (error) throw new Error(error.message)
      queryClient.invalidateQueries({ queryKey: ['water-logs', userId, start] })
    } catch (err) {
      toast({ title: 'Undo failed', description: (err as Error).message, variant: 'error' })
    }
  }

  return {
    logs: query.data?.logs ?? [],
    totalMl,
    tableMissing: query.data?.tableMissing ?? false,
    isLoading: query.isLoading,
    add,
    undo,
  }
}
