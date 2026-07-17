'use client'

import { useQuery } from '@tanstack/react-query'
import type { FoodLog } from '../types/index'
import { getIstDayRange } from '../lib/dateUtils'

export function useFoodLogs(userId: string | null, date = new Date(), initialData?: FoodLog[]) {
  const { start, end } = getIstDayRange(date)

  return useQuery({
    queryKey: ['food-logs', userId, start],
    enabled: Boolean(userId),
    initialData,
    queryFn: async () => {
      if (!userId) return [] as FoodLog[]
      const params = new URLSearchParams({ start, end })
      const res = await fetch(`/api/logs?${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to fetch food logs')
      }
      return res.json() as Promise<FoodLog[]>
    },
  })
}
