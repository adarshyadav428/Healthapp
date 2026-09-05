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

  // clientRequestId: generated once per logging attempt by the caller (not
  // here — a fresh call to `add` on every retry would defeat the point) so a
  // rapid double-tap or a retry of the SAME attempt collapses into one row
  // server-side instead of creating a duplicate. 2026-09-05 adversarial-audit F3.
  //
  // Returns whether the log succeeded — the caller (ExerciseLogger) only
  // clears its form and rotates to a fresh key on success, exactly like
  // WeightLogModal already does, so a retry after a genuine failure reuses
  // the same key instead of risking a duplicate if the "failed" attempt had
  // actually landed server-side.
  const add = async (
    activity: string,
    duration_min: number,
    calories: number,
    clientRequestId?: string
  ): Promise<boolean> => {
    if (!userId) return false
    try {
      const res = await fetch('/api/exercise/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity, duration_min, calories, client_request_id: clientRequestId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? 'Failed to log exercise')
      if (body.row) {
        queryClient.setQueryData<ExerciseLog[]>(['exercise-logs', userId], (old = []) => [body.row, ...old])
      } else {
        queryClient.invalidateQueries({ queryKey: ['exercise-logs', userId] })
      }
      return true
    } catch (err) {
      toast({ title: 'Could not log exercise', description: (err as Error).message, variant: 'error' })
      return false
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
