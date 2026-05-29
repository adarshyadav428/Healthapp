'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useFoodLogs } from '../../hooks/useFoodLogs'
import { useUser } from '../../hooks/useUser'
import { TodayProgressBar } from './TodayProgressBar'
import type { FoodLog } from '../../types/index'

// Recharts is ~95KB gzipped — keep it out of the initial /log bundle.
// Only loads when the user has actually logged calories.
const MacroPieChart = dynamic(() => import('./MacroPieChart').then(m => m.MacroPieChart), {
  ssr: false,
  loading: () => <div className="h-32 mt-4 rounded-2xl bg-card border border-border animate-pulse" />,
})

type Props = {
  initialLogs: FoodLog[]
  kcalTarget: number
  proteinTarget: number
  carbsTarget: number
  fatTarget: number
}

export function LogProgressClient({ initialLogs, kcalTarget, proteinTarget, carbsTarget, fatTarget }: Props) {
  const { user } = useUser()
  const { data: logs = initialLogs } = useFoodLogs(user?.id ?? null, new Date(), initialLogs)

  const totals = useMemo(
    () =>
      logs.reduce(
        (acc, l) => {
          acc.kcal += l.kcal
          acc.protein += l.protein_g
          acc.carbs += l.carbs_g
          acc.fat += l.fat_g
          return acc
        },
        { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      ),
    [logs]
  )

  return (
    <div>
      <TodayProgressBar
        kcalEaten={Math.round(totals.kcal)}
        kcalTarget={kcalTarget}
        proteinEaten={Math.round(totals.protein)}
        proteinTarget={proteinTarget}
        carbsEaten={Math.round(totals.carbs)}
        carbsTarget={carbsTarget}
        fatEaten={Math.round(totals.fat)}
        fatTarget={fatTarget}
      />
      {totals.kcal > 0 && (
        <MacroPieChart
          protein={Math.round(totals.protein)}
          carbs={Math.round(totals.carbs)}
          fat={Math.round(totals.fat)}
        />
      )}
    </div>
  )
}
