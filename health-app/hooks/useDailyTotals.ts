'use client'

import { useMemo } from 'react'
import type { DailyTotals } from '../types/index'
import { useFoodLogs } from './useFoodLogs'

/**
 * Totals for one IST day's logs. `date` defaults to today.
 *
 * Pass it explicitly wherever the user is acting on a day that isn't today —
 * the Food tab's day nav lets them log to a past date, and totals for the wrong
 * day are worse than no totals, because they read as authoritative.
 */
export function useDailyTotals(userId: string | null, date?: Date) {
  const { data: logs = [], isLoading, error } = useFoodLogs(userId, date)

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
