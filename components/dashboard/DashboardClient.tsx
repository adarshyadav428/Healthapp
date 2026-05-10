'use client'

import { useMemo, useState } from 'react'
import type { FoodLog, Profile } from '../../types/index'
import { CalorieSummary } from './CalorieSummary'
import { useFoodLogs } from '../../hooks/useFoodLogs'
import { useExerciseLogs } from '../../hooks/useExerciseLogs'
import { useUser } from '../../hooks/useUser'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../ui/use-toast'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { cn } from '../../lib/utils'
import { getUtcDayRange } from '../../lib/dateUtils'

const MEAL_META: Record<string, { icon: string; label: string }> = {
  breakfast: { icon: '🥣', label: 'Breakfast' },
  lunch:     { icon: '🍛', label: 'Lunch' },
  dinner:    { icon: '🍲', label: 'Dinner' },
  snack:     { icon: '🥜', label: 'Snacks' },
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

  const totals = useMemo(
    () =>
      logs.reduce(
        (acc, l) => { acc.kcal += l.kcal; acc.protein_g += l.protein_g; acc.carbs_g += l.carbs_g; acc.fat_g += l.fat_g; return acc },
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

  return (
    <>
      {/* ── Hero ring ── */}
      <CalorieSummary
        kcalEaten={Math.round(totals.kcal)}
        kcalBurned={totalCaloriesBurned}
        kcalTarget={profile.daily_calorie_target}
      />

      {/* ── Macro row ── */}
      <div className="flex gap-2 mt-6 mb-7">
        <MacroChip
          label="Protein"
          value={Math.round(totals.protein_g)}
          target={profile.protein_g_target}
          barClass="bg-indigo-500"
        />
        <MacroChip
          label="Carbs"
          value={Math.round(totals.carbs_g)}
          target={profile.carbs_g_target}
          barClass="bg-amber-400"
        />
        <MacroChip
          label="Fat"
          value={Math.round(totals.fat_g)}
          target={profile.fat_g_target}
          barClass="bg-rose-400"
        />
      </div>

      {/* ── Today's meals ── */}
      {hasLogs ? (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">
            Today&apos;s meals
          </p>
          {(Object.entries(byMeal) as [string, FoodLog[]][]).map(([meal, items]) => {
            if (items.length === 0) return null
            const mealKcal = items.reduce((s, i) => s + i.kcal, 0)
            const meta = MEAL_META[meal] ?? { icon: '🍽️', label: meal }
            return (
              <div
                key={meal}
                className="rounded-2xl bg-card border border-border overflow-hidden"
              >
                {/* Meal header */}
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {meta.icon}
                    <span>{meta.label}</span>
                  </span>
                  <span className="text-sm font-bold text-muted">
                    {Math.round(mealKcal)} kcal
                  </span>
                </div>

                {/* Food items */}
                {items.length > 0 && (
                  <div className="px-4 pb-3 space-y-1.5 border-t border-border/50">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between pt-1.5">
                        <p className="text-xs text-muted truncate max-w-[70%]">
                          {item.food?.name ?? 'Unknown food'}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {Math.round(item.kcal)} kcal
                          </span>
                          <button
                            type="button"
                            disabled={deletingId === item.id}
                            onClick={() => deleteLog(item.id)}
                            className="text-slate-400 dark:text-slate-400 hover:text-red-400 dark:hover:text-red-400 text-xs font-bold transition-colors disabled:opacity-40 px-1"
                            aria-label={`Remove ${item.food?.name}`}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* Empty state */
        <div className="py-12 text-center">
          <p className="text-3xl mb-3">🍽️</p>
          <p className="text-sm font-semibold text-foreground">Nothing logged yet</p>
          <p className="text-xs text-muted mt-1">Tap the button below to add your first meal</p>
        </div>
      )}

      {/* ── Sticky Log CTA (above floating nav) ── */}
      <div className="fixed inset-x-4 bottom-[90px] z-30 mx-auto max-w-md">
        <Link
          href="/log"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-4 text-[15px] font-black text-white shadow-xl shadow-orange-500/30 active:scale-[.98] transition-transform"
        >
          <Plus className="h-5 w-5" />
          Log Food
        </Link>
      </div>
    </>
  )
}

/* ── Sub-components ── */

function MacroChip({
  label,
  value,
  target,
  barClass,
}: {
  label: string
  value: number
  target: number | null
  barClass: string
}) {
  const pct = target && target > 0 ? Math.min((value / target) * 100, 100) : 0
  return (
    <div className="flex-1 rounded-2xl bg-card border border-border px-3 py-2.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-muted uppercase tracking-wide">{label[0]}</span>
        <span className="text-xs font-black text-foreground tabular-nums">{value}g</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {target && (
        <p className="text-[9px] text-muted mt-1.5">{label} · {target}g</p>
      )}
    </div>
  )
}

