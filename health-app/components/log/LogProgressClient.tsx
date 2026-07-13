'use client'

import { useMemo } from 'react'
import { useFoodLogs } from '../../hooks/useFoodLogs'
import { useUser } from '../../hooks/useUser'
import type { FoodLog } from '../../types/index'

type Props = {
  initialLogs: FoodLog[]
  kcalTarget: number
  proteinTarget: number
  carbsTarget: number
  fatTarget: number
}

// Ember Air Food summary card (1f): eaten / target, over-or-left in ember, a
// slim ember progress bar, and a compact P/C/F row. Live via useFoodLogs.
export function LogProgressClient({ initialLogs, kcalTarget }: Props) {
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

  const eaten = Math.round(totals.kcal)
  const over = eaten - kcalTarget
  const pct = kcalTarget > 0 ? Math.min((eaten / kcalTarget) * 100, 100) : 0

  return (
    <div className="rounded-[24px] bg-surface px-[22px] py-5" style={{ boxShadow: 'var(--shadow-air)' }}>
      <div className="flex items-baseline justify-between">
        <p className="font-display text-[28px] font-bold tabular-nums tracking-[-0.02em] text-ink">
          {eaten.toLocaleString('en-IN')}{' '}
          <span className="text-[14px] font-medium tracking-normal text-ink-3">/ {kcalTarget.toLocaleString('en-IN')} kcal</span>
        </p>
        <span className="text-[12.5px] font-semibold text-brand">
          {over >= 0 ? `${over.toLocaleString('en-IN')} over` : `${Math.abs(over).toLocaleString('en-IN')} left`}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-brand transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3.5 flex gap-5">
        <span className="text-[12px] text-ink-3">P <b className="font-bold tabular-nums text-ink">{Math.round(totals.protein)}g</b></span>
        <span className="text-[12px] text-ink-3">C <b className="font-bold tabular-nums text-ink">{Math.round(totals.carbs)}g</b></span>
        <span className="text-[12px] text-ink-3">F <b className="font-bold tabular-nums text-ink">{Math.round(totals.fat)}g</b></span>
      </div>
    </div>
  )
}
