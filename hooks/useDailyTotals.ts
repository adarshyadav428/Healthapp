'use client'

import { useMemo } from 'react'
import type { DailyTotals } from '../types/index'
import { useFoodLogs } from './useFoodLogs'

export function useDailyTotals(userId: string | null) {
  const { data: logs = [], isLoading, error } = useFoodLogs(userId)

  const totals = useMemo<DailyTotals>(() => {
    return logs.reduce(
      (acc, log) => {
        acc.kcal += log.kcal
        acc.protein_g += log.protein_g
        acc.carbs_g += log.carbs_g
        acc.fat_g += log.fat_g
        return acc
      },
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    )
  }, [logs])

  return { totals, isLoading, error }
}
