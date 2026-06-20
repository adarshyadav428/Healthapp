'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '../components/ui/use-toast'

export type SleepLog = {
  id: string
  sleep_date: string
  bedtime: string
  wake_time: string
  quality: number | null
  notes: string | null
}

/** Returns duration in minutes */
export function sleepDurationMin(log: SleepLog): number {
  return Math.round(
    (new Date(log.wake_time).getTime() - new Date(log.bedtime).getTime()) / 60000
  )
}

export function useSleepLogs(userId: string | null) {
  const queryClient = useQueryClient()

  const historyQuery = useQuery<SleepLog[]>({
    queryKey: ['sleep-history', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const res = await fetch('/api/sleep/history')
      if (!res.ok) return []
      return res.json()
    },
  })

  const addSleep = async (data: {
    sleep_date: string
    bedtime: string
    wake_time: string
    quality?: number
    notes?: string
  }): Promise<boolean> => {
    try {
      const res = await fetch('/api/sleep/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')
      queryClient.invalidateQueries({ queryKey: ['sleep-history', userId] })
      toast({ title: 'Sleep logged!', duration: 2500 })
      return true
    } catch (err) {
      toast({ title: 'Could not save sleep', description: (err as Error).message, variant: 'error' })
      return false
    }
  }

  const deleteSleep = async (id: string) => {
    // Optimistic remove
    queryClient.setQueryData<SleepLog[]>(['sleep-history', userId], (old = []) =>
      old.filter((s) => s.id !== id)
    )
    try {
      const res = await fetch('/api/sleep/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      queryClient.invalidateQueries({ queryKey: ['sleep-history', userId] })
      toast({ title: 'Could not delete sleep log', variant: 'error' })
    }
  }

  return {
    history: historyQuery.data ?? [],
    isLoading: historyQuery.isLoading,
    addSleep,
    deleteSleep,
  }
}
