'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { FoodLog, Profile } from '../../types/index'
import { CalorieRing } from '../home/CalorieRing'
import { MacroRow } from '../home/MacroRow'
import { MealGroup } from '../home/MealGroup'
import { EmptyMeals } from '../home/EmptyMeals'
import { PlanStrip } from '../home/PlanStrip'
import { EditFoodLogModal } from '../log/EditFoodLogModal'
import { useFoodLogs } from '../../hooks/useFoodLogs'
import { useUser } from '../../hooks/useUser'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../ui/use-toast'
import { getUtcDayRange } from '../../lib/dateUtils'
import { Flame } from 'lucide-react'

const WeightWidget = dynamic(
  () => import('./WeightWidget').then(m => m.WeightWidget),
  { ssr: false, loading: () => <div className="h-24 rounded-2xl bg-card-border animate-pulse" /> }
)

const MEAL_ORDER = ['breakfast', 'lunch', 'snack', 'dinner'] as const

interface Props {
  profile: Profile
  initialLogs: FoodLog[]
  streakDays: number
}

export function DashboardClient({ profile, initialLogs, streakDays }: Props) {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { data: logs = initialLogs } = useFoodLogs(user?.id ?? null, new Date(), initialLogs)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingLog, setEditingLog] = useState<FoodLog | null>(null)

  const totals = useMemo(
    () => logs.reduce(
      (acc, l) => {
        acc.kcal      += l.kcal
        acc.protein_g += l.protein_g
        acc.carbs_g   += l.carbs_g
        acc.fat_g     += l.fat_g
        return acc
      },
      { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
    ),
    [logs]
  )

  const byMeal = useMemo(
    () => Object.fromEntries(
      MEAL_ORDER.map(m => [m, logs.filter(l => l.meal === m)])
    ),
    [logs]
  )

  const deleteLog = async (id: string) => {
    if (deletingId) return
    setDeletingId(id)
    try {
      const res = await fetch('/api/logs/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Delete failed')
      const { start } = getUtcDayRange(new Date())
      queryClient.setQueryData<FoodLog[]>(['food-logs', user?.id, start], (old = []) =>
        old.filter(f => f.id !== id)
      )
    } catch (err) {
      toast({ title: 'Delete failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  const eaten = Math.round(totals.kcal)
  const target = profile.daily_calorie_target
  const kcalLeft = target - eaten

  // Derive a rough maintenance estimate (target + deficit)
  const pace = profile.pace_kg_per_week ?? 0.5
  const deficitPerDay = Math.round((pace * 7700) / 7)
  const maintenance = target + (profile.goal === 'lose' ? deficitPerDay : profile.goal === 'gain' ? -deficitPerDay : 0)

  const todayDate = new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long' })
  const hasLogs = logs.length > 0
  const totalMealKcal = Math.round(totals.kcal)

  return (
    <div className="space-y-3">

      {/* ── Calorie hero card ── */}
      <div
        className="rounded-[24px] px-6 pt-5 pb-6"
        style={{
          background: 'linear-gradient(180deg, #FFF0E7 0%, #fff 58%)',
          border: '1px solid #FBDCCB',
          boxShadow: '0 8px 26px -12px rgba(20,24,29,.10)',
        }}
      >
        {/* Top row: date + streak */}
        <div className="flex items-center justify-between mb-5">
          <p className="text-[12px] font-semibold text-muted">Today · {todayDate}</p>
          {streakDays > 0 && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full"
              style={{ background: '#FFF0E7' }}
            >
              <Flame className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
              <span className="text-[11.5px] font-bold" style={{ color: '#B5471A' }}>
                {streakDays}-day streak
              </span>
            </div>
          )}
        </div>

        {/* Ring */}
        <CalorieRing eaten={eaten} target={target} kcalLeft={kcalLeft} />

        {/* Macro row */}
        <div className="mt-5">
          <MacroRow
            proteinEaten={Math.round(totals.protein_g)}
            carbsEaten={Math.round(totals.carbs_g)}
            fatEaten={Math.round(totals.fat_g)}
            proteinTarget={profile.protein_g_target ?? 0}
            carbsTarget={profile.carbs_g_target ?? 0}
            fatTarget={profile.fat_g_target ?? 0}
          />
        </div>
      </div>

      {/* ── Today's meals ── */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <p className="text-[17px] font-bold text-ink">Today&apos;s meals</p>
          {hasLogs && (
            <p className="text-[13px] font-semibold text-secondary tabular-nums">
              {totalMealKcal} kcal
            </p>
          )}
        </div>

        {hasLogs ? (
          <div className="space-y-2">
            {MEAL_ORDER.map(meal => {
              const items = byMeal[meal] ?? []
              if (items.length === 0) return null
              return (
                <MealGroup
                  key={meal}
                  meal={meal}
                  items={items}
                  onEdit={setEditingLog}
                  onDelete={deleteLog}
                  deletingId={deletingId}
                />
              )
            })}
          </div>
        ) : (
          <EmptyMeals />
        )}
      </div>

      {/* ── Plan strip ── */}
      <PlanStrip
        calorieTarget={target}
        maintenanceKcal={maintenance}
        goal={profile.goal}
      />

      {/* ── Weight quick-log ── */}
      <WeightWidget currentWeightKg={profile.current_weight_kg ?? null} />

      {/* Edit modal */}
      {editingLog && (
        <EditFoodLogModal
          log={editingLog}
          onClose={() => setEditingLog(null)}
        />
      )}
    </div>
  )
}
