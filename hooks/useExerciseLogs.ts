'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ExerciseLog } from '../types/index'
import { toast } from '../components/ui/use-toast'

export function useExerciseLogs(userId: string | null, initialData?: ExerciseLog[]) {
  const queryClient = useQueryClient()

  const query = useQuery<ExerciseLog[]>({
    queryKey: ['exercise-logs', userId],
    enabled: Boolean(userId),
    initialData,
    queryFn: async (): Promise<ExerciseLog[]> => {
      const res = await fetch('/api/exercise/today')
      if (!res.ok) return []
      return res.json()
    },
  })

  const logs = query.data ?? []
  const totalCaloriesBurned = logs.reduce((sum, l) => sum + Number(l.calories), 0)

  const add = async (activity: string, duration_min: number, calories: number) => {
    if (!userId) return
    try {
      const res = await fetch('/api/exercise/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity, duration_min, calories }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Failed to log exercise')
      if (body.row) {
        queryClient.setQueryData<ExerciseLog[]>(['exercise-logs', userId], (old = []) => [body.row, ...old])
      } else {
        queryClient.invalidateQueries({ queryKey: ['exercise-logs', userId] })
      }
    } catch (err) {
      toast({ title: 'Could not log exercise', description: (err as Error).message, variant: 'error' })
    }
  }

  const remove = async (id: string) => {
    if (!userId) return
    try {
      const res = await fetch('/api/exercise/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Failed to delete')
      queryClient.setQueryData<ExerciseLog[]>(['exercise-logs', userId], (old = []) => old.filter(l => l.id !== id))
    } catch (err) {
      toast({ title: 'Delete failed', description: (err as Error).message, variant: 'error' })
    }
  }

  return { logs, totalCaloriesBurned, isLoading: query.isLoading, add, remove }
}
