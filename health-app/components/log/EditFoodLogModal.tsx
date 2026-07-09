'use client'

import { useMemo, useRef, useState } from 'react'
import type { FoodLog } from '../../types/index'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../ui/use-toast'
import { Sheet, SheetContent } from '../ui/sheet'
import { Button } from '../ui/button'
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

export function EditFoodLogModal({ log, onClose, onSaved }: { log: FoodLog; onClose: () => void; onSaved?: () => void }) {
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
      onSaved?.()
      onClose()
    } catch (err) {
      toast({ title: 'Update failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setSaving(false)
      inFlight.current = false
    }
  }

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="sm:max-w-sm space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-ink">Edit entry</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-surface-2 transition-colors"
          >
            <X className="h-4 w-4 text-ink-2" />
          </button>
        </div>

        {/* Food name */}
        <div className="rounded-card bg-brand-soft border border-hairline px-3 py-2.5">
          <p className="text-sm font-semibold text-ink truncate">{food?.name ?? 'Food item'}</p>
          {food?.brand && <p className="text-xs text-ink-2">{food.brand}</p>}
        </div>

        {/* Grams input */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-2 mb-1.5">
            Amount (grams)
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGrams((g) => Math.max(5, Math.round(g - 10)))}
              className="h-10 w-10 rounded-control border border-hairline bg-surface-2 text-ink font-bold hover:bg-hairline/40 flex-shrink-0 transition-colors"
            >
              −
            </button>
            <input
              type="number"
              value={grams}
              min={1}
              step={5}
              onChange={(e) => setGrams(parseFloat(e.target.value) || 0)}
              className="flex-1 rounded-control border border-hairline bg-surface text-ink px-4 py-2.5 text-sm text-center outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring transition-all"
            />
            <button
              type="button"
              onClick={() => setGrams((g) => Math.round(g + 10))}
              className="h-10 w-10 rounded-control border border-hairline bg-surface-2 text-ink font-bold hover:bg-hairline/40 flex-shrink-0 transition-colors"
            >
              +
            </button>
          </div>
          {food?.serving_size_g && food.serving_size_g !== 100 && (
            <p className="mt-1 text-xs text-ink-2">
              {food.serving_description && food.serving_description !== `${food.serving_size_g}g`
                ? `1 serving = ${food.serving_description}`
                : `1 serving = ${food.serving_size_g}g`}
            </p>
          )}
        </div>

        {/* Meal selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-2 mb-1.5">Meal</label>
          <div className="grid grid-cols-4 gap-1.5">
            {MEAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMeal(opt.value)}
                className={`rounded-control border py-2 text-xs font-semibold transition-all active:scale-95 ${
                  meal === opt.value
                    ? 'border-brand bg-brand-soft text-brand-ink'
                    : 'border-hairline bg-surface-2 text-ink-2 hover:border-brand/40'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Nutrition preview */}
        {hasFood && (
          <div className="grid grid-cols-4 gap-2 rounded-card border border-hairline bg-energy-soft px-3 py-2.5">
            <div className="text-center">
              <p className="text-sm font-bold text-energy-ink tabular-nums">{Math.round(nutrition.kcal)}</p>
              <p className="text-[10px] text-energy-ink">kcal</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--protein)' }}>{Math.round(nutrition.protein)}g</p>
              <p className="text-[10px] text-ink-2">P</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--carbs)' }}>{Math.round(nutrition.carbs)}g</p>
              <p className="text-[10px] text-ink-2">C</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--fat)' }}>{Math.round(nutrition.fat)}g</p>
              <p className="text-[10px] text-ink-2">F</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" size="lg" onClick={onClose} className="flex-1 tap-scale">
            Cancel
          </Button>
          <Button type="button" size="lg" onClick={handleSave} disabled={saving || grams <= 0} className="flex-1 tap-scale">
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
