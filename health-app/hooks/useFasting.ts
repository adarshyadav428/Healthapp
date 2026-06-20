'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '../components/ui/use-toast'

export type FastingSession = {
  id: string
  started_at: string
  ended_at: string | null
  target_hours: number
}

export function useFasting(userId: string | null) {
  const queryClient = useQueryClient()

  const activeQuery = useQuery<FastingSession | null>({
    queryKey: ['fasting-active', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const res = await fetch('/api/fasting/active')
      if (!res.ok) return null
      return res.json()
    },
    refetchInterval: 60_000, // refresh every minute to stay in sync
  })

  const historyQuery = useQuery<FastingSession[]>({
    queryKey: ['fasting-history', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const res = await fetch('/api/fasting/history')
      if (!res.ok) return []
      return res.json()
    },
  })

  const startFast = async (targetHours: number) => {
    try {
      const res = await fetch('/api/fasting/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_hours: targetHours }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to start fast')
      queryClient.invalidateQueries({ queryKey: ['fasting-active', userId] })
      queryClient.invalidateQueries({ queryKey: ['fasting-history', userId] })
      toast({ title: `${targetHours}-hour fast started!`, description: 'Your fasting timer is running.', duration: 3000 })
    } catch (err) {
      toast({ title: 'Could not start fast', description: (err as Error).message, variant: 'error' })
    }
  }

  const stopFast = async () => {
    try {
      const res = await fetch('/api/fasting/stop', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to stop fast')
      queryClient.invalidateQueries({ queryKey: ['fasting-active', userId] })
      queryClient.invalidateQueries({ queryKey: ['fasting-history', userId] })
      toast({ title: 'Fast ended!', description: 'Great work — your fast has been logged.', duration: 3000 })
    } catch (err) {
      toast({ title: 'Could not stop fast', description: (err as Error).message, variant: 'error' })
    }
  }

  return {
    activeSession: activeQuery.data ?? null,
    history: historyQuery.data ?? [],
    isLoading: activeQuery.isLoading,
    startFast,
    stopFast,
  }
}
