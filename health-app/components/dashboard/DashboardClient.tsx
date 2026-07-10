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

  const todayDate = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  const hasLogs = logs.length > 0
  const totalMealKcal = Math.round(totals.kcal)
  const firstName = profile.display_name?.split(' ')[0] ?? 'there'
  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <div className="space-y-4">

      {/* ── Editorial greeting ── */}
      <div className="px-1 pt-2">
        <p className="text-[10.5px] font-medium uppercase tracking-[.12em] text-ink-3">{todayDate}</p>
        <h2 className="font-display mt-1.5 text-[23px] font-semibold tracking-tight text-ink">
          {greeting}, {firstName}
        </h2>
        <p className="mt-0.5 text-[13.5px] text-ink-2">
          {kcalLeft >= 0
            ? `${kcalLeft.toLocaleString('en-IN')} kcal to go — right on track`
            : `${Math.abs(kcalLeft).toLocaleString('en-IN')} kcal over — tomorrow's a fresh start`}
        </p>
      </div>

      {/* ── Calorie hero card ── */}
      <div className="rounded-card bg-surface bg-hero-wash px-6 pb-6 pt-5 shadow-rest">
        {/* Top row: label + streak */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[10.5px] font-medium uppercase tracking-[.12em] text-ink-3">Today</p>
          {streakDays > 0 && (
            <div className="flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1">
              <Flame className="h-3 w-3 text-brand" strokeWidth={2} />
              <span className="text-[11.5px] font-semibold text-brand-ink">
                {streakDays} days
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
        <div className="mb-2.5 flex items-baseline justify-between px-1">
          <p className="text-[15px] font-semibold tracking-tight text-ink">Today&apos;s meals</p>
          {hasLogs && (
            <p className="text-[12px] font-medium text-ink-3 tabular-nums">
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
