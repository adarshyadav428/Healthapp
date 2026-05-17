'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '../components/ui/use-toast'

export type MeasurementLog = {
  id: string
  user_id: string
  waist_cm: number | null
  chest_cm: number | null
  hips_cm: number | null
  arms_cm: number | null
  measured_at: string
  created_at: string
}

export function useMeasurements(userId: string | null) {
  const queryClient = useQueryClient()

  const query = useQuery<MeasurementLog[]>({
    queryKey: ['measurements', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const res = await fetch('/api/measurements')
      if (!res.ok) return []
      return res.json()
    },
  })

  const addMeasurement = async (data: {
    waist_cm?: number
    chest_cm?: number
    hips_cm?: number
    arms_cm?: number
    measured_at?: string
  }) => {
    try {
      const res = await fetch('/api/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')
      queryClient.invalidateQueries({ queryKey: ['measurements', userId] })
      toast({ title: 'Measurements saved!', duration: 2500 })
      return true
    } catch (err) {
      toast({ title: 'Save failed', description: (err as Error).message, variant: 'error' })
      return false
    }
  }

  const deleteMeasurement = async (id: string) => {
    // Optimistic remove
    queryClient.setQueryData<MeasurementLog[]>(['measurements', userId], (old = []) =>
      old.filter((m) => m.id !== id)
    )
    try {
      const res = await fetch('/api/measurements', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      queryClient.invalidateQueries({ queryKey: ['measurements', userId] })
      toast({ title: 'Could not delete measurement', variant: 'error' })
    }
  }

  return {
    measurements: query.data ?? [],
    isLoading: query.isLoading,
    addMeasurement,
    deleteMeasurement,
  }
}
