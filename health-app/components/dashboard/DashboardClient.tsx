'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { FoodLog, Profile } from '../../types/index'
import { CalorieSummary } from './CalorieSummary'
import { useFoodLogs } from '../../hooks/useFoodLogs'
import { useExerciseLogs } from '../../hooks/useExerciseLogs'
import { useUser } from '../../hooks/useUser'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../ui/use-toast'
import Link from 'next/link'
import { Pencil, Trash2 } from 'lucide-react'
import { EditFoodLogModal } from '../log/EditFoodLogModal'
import { getUtcDayRange } from '../../lib/dateUtils'

const SkeletonCard = () => <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
const WeightWidget    = dynamic(() => import('./WeightWidget').then(m => m.WeightWidget),    { ssr: false, loading: SkeletonCard })
const WeeklyDeficitCard = dynamic(() => import('../progress/WeeklyDeficitCard').then(m => m.WeeklyDeficitCard), { ssr: false, loading: () => <div className="h-56 rounded-2xl bg-gray-100 animate-pulse" /> })
const WaterTracker    = dynamic(() => import('../log/WaterTracker').then(m => m.WaterTracker), { ssr: false, loading: SkeletonCard })

const MEAL_META: Record<string, { emoji: string; label: string; bg: string }> = {
  breakfast: { emoji: '🌅', label: 'Breakfast', bg: '#FEF3C7' },
  lunch:     { emoji: '☀️', label: 'Lunch',     bg: '#DCFCE7' },
  dinner:    { emoji: '🌙', label: 'Dinner',    bg: '#EDE9FE' },
  snack:     { emoji: '⭐', label: 'Snacks',    bg: '#FFF4EE' },
}

const FOOD_BG    = ['#FEE2E2', '#FEF3C7', '#D1FAE5', '#DBEAFE', '#EDE9FE', '#FFEDD5']
const FOOD_TEXT  = ['#DC2626', '#D97706', '#059669', '#2563EB', '#7C3AED', '#EA580C']

function foodColor(name: string) {
  const i = (name.charCodeAt(0) || 0) % FOOD_BG.length
  return { bg: FOOD_BG[i], text: FOOD_TEXT[i] }
}

export function DashboardClient({
  profile,
  initialLogs,
}: {
  profile: Profile
  initialLogs: FoodLog[]
}) {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { data: logs = initialLogs } = useFoodLogs(user?.id ?? null, new Date(), initialLogs)
  const { totalCaloriesBurned } = useExerciseLogs(user?.id ?? null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingLog, setEditingLog] = useState<FoodLog | null>(null)

  const totals = useMemo(
    () =>
      logs.reduce(
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
    () => ({
      breakfast: logs.filter((l) => l.meal === 'breakfast'),
      lunch:     logs.filter((l) => l.meal === 'lunch'),
      dinner:    logs.filter((l) => l.meal === 'dinner'),
      snack:     logs.filter((l) => l.meal === 'snack'),
    }),
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
      queryClient.setQueryData<FoodLog[]>(['food-logs', user?.id, start], (old = []) => old.filter(f => f.id !== id))
    } catch (err) {
      toast({ title: 'Delete failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  const hasLogs = logs.length > 0
  const totalMealKcal = Math.round(totals.kcal)

  return (
    <div className="space-y-3">
      {/* ── Today's Intake card ── */}
      <CalorieSummary
        kcalEaten={Math.round(totals.kcal)}
        kcalBurned={totalCaloriesBurned}
        kcalTarget={profile.daily_calorie_target}
        proteinEaten={Math.round(totals.protein_g)}
        carbsEaten={Math.round(totals.carbs_g)}
        fatEaten={Math.round(totals.fat_g)}
        proteinTarget={profile.protein_g_target ?? 0}
        carbsTarget={profile.carbs_g_target ?? 0}
        fatTarget={profile.fat_g_target ?? 0}
      />

      {/* ── Today's Meals ── */}
      {hasLogs ? (
        <div>
          {/* Section header */}
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-[13px] font-semibold text-[#1A1A2E]">Today&apos;s Meals</p>
            <p className="text-[13px] font-semibold text-[#EA580C]">{totalMealKcal} kcal</p>
          </div>

          <div className="space-y-2">
            {(Object.entries(byMeal) as [string, FoodLog[]][]).map(([meal, items]) => {
              if (items.length === 0) return null
              const mealKcal = items.reduce((s, i) => s + i.kcal, 0)
              const meta = MEAL_META[meal] ?? { emoji: '🍽️', label: meal, bg: '#F0F0F0' }
              return (
                <div
                  key={meal}
                  className="bg-white rounded-2xl overflow-hidden"
                  style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                >
                  {/* Meal header */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
                        style={{ background: meta.bg }}
                      >
                        {meta.emoji}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#1A1A2E]">{meta.label}</p>
                        <p className="text-[10px] text-[#6B7280]">
                          {items.length} item{items.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-[#6B7280]">
                      {Math.round(mealKcal)} kcal
                    </span>
                  </div>

                  {/* Food items */}
                  <div className="border-t border-[#F0F0F0] px-4 pb-3">
                    {items.map((item) => {
                      const name   = item.food?.name ?? 'Unknown food'
                      const colors = foodColor(name)
                      return (
                        <div key={item.id} className="flex items-center gap-3 pt-3">
                          {/* Letter circle (food image placeholder) */}
                          <div
                            className="h-[52px] w-[52px] rounded-xl flex-shrink-0 flex items-center justify-center text-lg font-bold"
                            style={{ background: colors.bg, color: colors.text }}
                          >
                            {name[0]?.toUpperCase()}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#1A1A2E] truncate">{name}</p>
                            <p className="text-xs text-[#6B7280]">{Math.round(item.kcal)} kcal</p>
                            <div className="flex gap-2 mt-0.5">
                              <span className="text-[10px] font-medium text-[#3B82F6]">P {Math.round(item.protein_g)}g</span>
                              <span className="text-[10px] text-[#9CA3AF]">·</span>
                              <span className="text-[10px] font-medium text-[#F59E0B]">C {Math.round(item.carbs_g)}g</span>
                              <span className="text-[10px] text-[#9CA3AF]">·</span>
                              <span className="text-[10px] font-medium text-[#EF4444]">F {Math.round(item.fat_g)}g</span>
                            </div>
                          </div>

                          {/* Edit / Delete */}
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => setEditingLog(item)}
                              className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#EA580C] hover:bg-orange-50 transition-colors"
                              aria-label={`Edit ${name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={deletingId === item.id}
                              onClick={() => deleteLog(item.id)}
                              className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-[#EF4444] hover:bg-red-50 transition-colors disabled:opacity-40"
                              aria-label={`Delete ${name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    <Link
                      href="/log"
                      className="block text-xs font-semibold text-[#EA580C] mt-3 hover:underline"
                    >
                      + Add more food
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Empty state */
        <div
          className="bg-white rounded-2xl py-12 text-center"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
        >
          <p className="text-4xl mb-3">🍽️</p>
          <p className="text-sm font-semibold text-[#1A1A2E]">Nothing logged yet</p>
          <p className="text-xs text-[#6B7280] mt-1">Tap the + button below to add your first meal</p>
        </div>
      )}

      {/* ── Water Tracker ── */}
      <WaterTracker waterTargetMl={profile.water_target_ml ?? 2500} />

      {/* ── Weekly Deficit ── */}
      <WeeklyDeficitCard />

      {/* ── Weight quick-log ── */}
      <WeightWidget currentWeightKg={profile.current_weight_kg ?? null} />

      {/* ── Edit food log modal ── */}
      {editingLog && (
        <EditFoodLogModal
          log={editingLog}
          onClose={() => setEditingLog(null)}
        />
      )}
    </div>
  )
}
