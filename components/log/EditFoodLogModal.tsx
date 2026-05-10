'use client'

import { useMemo, useRef, useState } from 'react'
import type { FoodLog } from '../../types/index'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../ui/use-toast'
import { X } from 'lucide-react'
import { getUtcDayRange } from '../../lib/dateUtils'
import { useUser } from '../../hooks/useUser'

const MEAL_OPTIONS = [
  { value: 'breakfast', label: '🥣 Breakfast' },
  { value: 'lunch',     label: '🍛 Lunch' },
  { value: 'dinner',    label: '🍲 Dinner' },
  { value: 'snack',     label: '🥜 Snack' },
] as const

type MealValue = (typeof MEAL_OPTIONS)[number]['value']

const round2 = (n: number) => Math.round(n * 100) / 100

export function EditFoodLogModal({ log, onClose }: { log: FoodLog; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { user } = useUser()
  // DB stores grams-per-serving + servings count; edit as total grams for simplicity
  const [grams, setGrams] = useState(Math.round(log.grams * (log.servings || 1)))
  const [meal, setMeal] = useState<MealValue>(log.meal as MealValue)
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)

  const food = log.food
  const hasFood = Boolean(food)

  const nutrition = useMemo(() => {
    if (!food) return { kcal: log.kcal, protein: log.protein_g, carbs: log.carbs_g, fat: log.fat_g }
    const factor = grams / 100
    return {
      kcal:    round2(food.kcal_per_100g      * factor),
      protein: round2(food.protein_g_per_100g * factor),
      carbs:   round2(food.carbs_g_per_100g   * factor),
      fat:     round2(food.fat_g_per_100g     * factor),
    }
  }, [food, grams, log])

  const handleSave = async () => {
    if (inFlight.current || saving) return
    if (grams <= 0 || isNaN(grams)) {
      toast({ title: 'Invalid grams', description: 'Enter a positive number.', variant: 'error' })
      return
    }
    inFlight.current = true
    setSaving(true)
    try {
      const res = await fetch('/api/logs/edit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: log.id,
          grams,
          servings: 1,
          meal,
          kcal:      nutrition.kcal,
          protein_g: nutrition.protein,
          carbs_g:   nutrition.carbs,
          fat_g:     nutrition.fat,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Update failed')

      // Update cache in-place — no re-fetch needed
      const { start } = getUtcDayRange(new Date())
      queryClient.setQueryData<FoodLog[]>(['food-logs', user?.id, start], (old = []) =>
        old.map(f =>
          f.id === log.id
            ? { ...f, grams, servings: 1, meal, kcal: nutrition.kcal, protein_g: nutrition.protein, carbs_g: nutrition.carbs, fat_g: nutrition.fat }
            : f
        )
      )
      toast({ title: 'Entry updated', duration: 2000 })
      onClose()
    } catch (err) {
      toast({ title: 'Update failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setSaving(false)
      inFlight.current = false
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm mx-auto bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-700 p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">Edit entry</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4 text-muted" />
          </button>
        </div>

        {/* Food name */}
        <div className="rounded-2xl bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30 px-3 py-2.5">
          <p className="text-sm font-semibold text-foreground truncate">{food?.name ?? 'Food item'}</p>
          {food?.brand && <p className="text-xs text-muted">{food.brand}</p>}
        </div>

        {/* Grams input */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
            Amount (grams)
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGrams((g) => Math.max(5, Math.round(g - 10)))}
              className="h-10 w-10 rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-foreground font-bold hover:bg-gray-100 dark:hover:bg-slate-700 flex-shrink-0 transition-colors"
            >
              −
            </button>
            <input
              type="number"
              value={grams}
              min={1}
              step={5}
              onChange={(e) => setGrams(parseFloat(e.target.value) || 0)}
              className="flex-1 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-foreground px-4 py-2.5 text-sm text-center outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 transition-all"
            />
            <button
              type="button"
              onClick={() => setGrams((g) => Math.round(g + 10))}
              className="h-10 w-10 rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-foreground font-bold hover:bg-gray-100 dark:hover:bg-slate-700 flex-shrink-0 transition-colors"
            >
              +
            </button>
          </div>
          {food?.serving_size_g && (
            <p className="mt-1 text-xs text-muted">
              1 serving = {food.serving_size_g}g
              {food.serving_description && food.serving_description !== `${food.serving_size_g}g` ? ` (${food.serving_description})` : ''}
            </p>
          )}
        </div>

        {/* Meal selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">Meal</label>
          <div className="grid grid-cols-4 gap-1.5">
            {MEAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMeal(opt.value)}
                className={`rounded-2xl border py-2 text-xs font-semibold transition-all active:scale-95 ${
                  meal === opt.value
                    ? 'border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-700 dark:bg-orange-950/40 dark:text-orange-300'
                    : 'border-gray-100 bg-gray-50 text-muted hover:border-orange-200 hover:bg-orange-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-orange-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Nutrition preview */}
        {hasFood && (
          <div className="grid grid-cols-4 gap-2 rounded-2xl border border-orange-100 dark:border-orange-900/30 bg-orange-50 dark:bg-orange-950/20 px-3 py-2.5">
            <div className="text-center">
              <p className="text-sm font-black text-orange-700 dark:text-orange-400">{Math.round(nutrition.kcal)}</p>
              <p className="text-[10px] text-orange-500 dark:text-orange-500">kcal</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-blue-600 dark:text-blue-400">{Math.round(nutrition.protein)}g</p>
              <p className="text-[10px] text-muted">P</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-amber-600 dark:text-amber-400">{Math.round(nutrition.carbs)}g</p>
              <p className="text-[10px] text-muted">C</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-rose-600 dark:text-rose-400">{Math.round(nutrition.fat)}g</p>
              <p className="text-[10px] text-muted">F</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-gray-200 dark:border-slate-700 py-3 text-sm font-semibold text-muted hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || grams <= 0}
            className="flex-1 rounded-2xl bg-orange-600 hover:bg-orange-700 py-3 text-sm font-bold text-white disabled:opacity-60 transition-colors shadow-sm"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
