'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { WaterLog } from '../types/index'
import { toast } from '../components/ui/use-toast'

export function useWaterLogs(userId: string | null, initialData?: WaterLog[]) {
  const queryClient = useQueryClient()

  const query = useQuery<WaterLog[]>({
    queryKey: ['water-logs', userId],
    enabled: Boolean(userId),
    initialData,
    queryFn: async (): Promise<WaterLog[]> => {
      const res = await fetch('/api/water/today')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        // If table doesn't exist yet, return empty gracefully
        return []
      }
      return res.json()
    },
  })

  const logs = query.data ?? []
  const totalMl = logs.reduce((sum, l) => sum + Number(l.ml), 0)
  const latestId = logs[0]?.id ?? null

  const add = async (ml: number) => {
    if (!userId || ml <= 0) return
    try {
      const res = await fetch('/api/water/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ml }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Failed to add water')
      if (body.row) {
        queryClient.setQueryData<WaterLog[]>(['water-logs', userId], (old = []) => [body.row, ...old])
      } else {
        queryClient.invalidateQueries({ queryKey: ['water-logs', userId] })
      }
    } catch (err) {
      toast({ title: 'Could not log water', description: (err as Error).message, variant: 'error' })
    }
  }

  const undo = async () => {
    if (!userId || !latestId) return
    try {
      const res = await fetch('/api/water/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: latestId }),
      })
      if (!res.ok) throw new Error('Failed to undo')
      queryClient.setQueryData<WaterLog[]>(['water-logs', userId], (old = []) => old.filter(l => l.id !== latestId))
    } catch (err) {
      toast({ title: 'Undo failed', description: (err as Error).message, variant: 'error' })
    }
  }

  return { logs, totalMl, isLoading: query.isLoading, add, undo }
}
