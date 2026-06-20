'use client'

import { useQuery } from '@tanstack/react-query'
import type { WeightLog } from '../types/index'

export function useWeightLogs(userId: string | null, initialData?: WeightLog[]) {
  return useQuery({
    queryKey: ['weight-logs', userId],
    enabled: Boolean(userId),
    initialData,
    queryFn: async () => {
      if (!userId) return [] as WeightLog[]
      const res = await fetch('/api/weight/logs')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed to fetch weight logs')
      }
      return res.json() as Promise<WeightLog[]>
    },
  })
}
