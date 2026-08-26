'use client'

import { useMemo, useRef, useState } from 'react'
import type { FoodLog } from '../../types/index'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../ui/use-toast'
import { Sheet, SheetContent } from '../ui/sheet'
import { Button } from '../ui/button'
import { X, ChevronDown } from 'lucide-react'
import { getIstDayRange } from '../../lib/dateUtils'
import { MEAL_CONTEXTS, MEAL_CONTEXT_LABELS, isMealContext, type MealContext } from '../../lib/mealContext'
import { useUser } from '../../hooks/useUser'
import { buildUnits, inferPortionSelection, quantityBounds, stepQuantity, normalizeQuantity, GRAMS_UNIT, type Unit } from '../../lib/portion-units'
import { UnitPicker } from './UnitPicker'
import { userFacingApiError } from '../../lib/apiError'

const MEAL_OPTIONS = [
  { value: 'breakfast', label: '🥣 Breakfast' },
  { value: 'lunch',     label: '🍛 Lunch' },
  { value: 'dinner',    label: '🍲 Dinner' },
  { value: 'snack',     label: '🥜 Snack' },
] as const

type MealValue = (typeof MEAL_OPTIONS)[number]['value']

const round2 = (n: number) => Math.round(n * 100) / 100

export function EditFoodLogModal({ log, onClose, onSaved, logDate = new Date() }: { log: FoodLog; onClose: () => void; onSaved?: () => void; logDate?: Date }) {
  const queryClient = useQueryClient()
  const { user } = useUser()

  const food = log.food
  const hasFood = Boolean(food)

  // DB stores grams-per-serving + servings count; edit as total grams for simplicity
  const baseGrams = Math.round(log.grams * (log.servings || 1))

  // Household units (katori / bowl / glass / piece …) — same engine as AddFoodModal.
  // Open on the unit that most naturally expresses the stored grams
  // (150g rice → "1 × katori"; irregular amounts fall back to grams).
  const units = useMemo(() => (food ? buildUnits(food) : [GRAMS_UNIT]), [food])
  const initial = useMemo(() => inferPortionSelection(units, baseGrams), [units, baseGrams])

  const [unit, setUnit] = useState<Unit>(initial.unit)
  const [quantityStr, setQuantityStr] = useState(String(initial.quantity))
  const [showUnitPicker, setShowUnitPicker] = useState(false)
  const [meal, setMeal] = useState<MealValue>(log.meal as MealValue)
  // Optional by design (migration 032): a log without a context is a perfectly
  // good log, so this never blocks saving and tapping the active chip clears it.
  const [context, setContext] = useState<MealContext | null>(
    isMealContext(log.context) ? log.context : null
  )
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)

  const quantity = Math.max(0, parseFloat(quantityStr) || 0)
  const grams = round2(unit.toGrams(quantity))

  // Stepper granularity, bounds and blur repair are shared with AddFoodModal so
  // both sheets agree on what one tap of − / + means (lib/portion-units.ts).
  const bounds = quantityBounds(unit)
  const stepBy = (dir: 1 | -1) => setQuantityStr(String(stepQuantity(quantity, dir, unit)))
  const onQuantityChange = (raw: string) => setQuantityStr(raw.replace(/[^0-9.]/g, ''))
  const onQuantityBlur = () => setQuantityStr(String(normalizeQuantity(quantityStr, unit)))

  // Switching measure keeps the amount constant — re-express current grams in the new unit
  const switchUnit = (u: Unit) => {
    const per = u.toGrams(1)
    setUnit(u)
    setQuantityStr(String(per > 0 ? round2(grams / per) : 1))
    setShowUnitPicker(false)
  }

  const nutrition = useMemo(() => {
    if (food) {
      const factor = grams / 100
      return {
        kcal:    round2(food.kcal_per_100g      * factor),
        protein: round2(food.protein_g_per_100g * factor),
        carbs:   round2(food.carbs_g_per_100g   * factor),
        fat:     round2(food.fat_g_per_100g     * factor),
      }
    }
    // No linked food (custom/AI entry): scale the stored macros with the grams change
    const scale = baseGrams > 0 ? grams / baseGrams : 1
    return {
      kcal:    round2(log.kcal      * scale),
      protein: round2(log.protein_g * scale),
      carbs:   round2(log.carbs_g   * scale),
      fat:     round2(log.fat_g     * scale),
    }
  }, [food, grams, baseGrams, log])

  const handleSave = async () => {
    if (inFlight.current || saving) return
    if (grams <= 0 || isNaN(grams)) {
      toast({ title: 'Invalid amount', description: 'Enter a positive quantity.', variant: 'error' })
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
          context,
          kcal:      nutrition.kcal,
          protein_g: nutrition.protein,
          carbs_g:   nutrition.carbs,
          fat_g:     nutrition.fat,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(userFacingApiError(res.status, data?.error, 'Could not update this entry.'))

      // Update cache in-place — no re-fetch needed (keyed to the day this
      // entry belongs to, not necessarily today — see logDate)
      const { start } = getIstDayRange(logDate)
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
      <SheetContent title="Edit food entry" className="sm:max-w-sm space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-display text-body-lg font-bold text-ink">Edit entry</h2>
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
          <p className="text-body font-semibold text-ink truncate">{food?.name ?? 'Food item'}</p>
          {food?.brand && <p className="text-caption text-ink-2">{food.brand}</p>}
        </div>

        {/* Quantity + Measure */}
        <div>
          <label className="block text-caption font-semibold uppercase tracking-caps text-ink-2 mb-1.5">
            Amount
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => stepBy(-1)}
              disabled={quantity <= bounds.min}
              aria-label="Decrease amount"
              className="h-10 w-10 rounded-control border border-hairline bg-surface-2 text-ink font-bold hover:bg-hairline flex-shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              −
            </button>
            <input
              type="number"
              inputMode="decimal"
              value={quantityStr}
              min={bounds.min}
              max={bounds.max}
              step={bounds.step}
              onChange={(e) => onQuantityChange(e.target.value)}
              onBlur={onQuantityBlur}
              onFocus={(e) => e.target.select()}
              className="w-20 flex-shrink-0 rounded-control border border-hairline bg-surface text-ink px-2 py-2.5 text-body text-center tabular-nums outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring transition-all"
            />
            <button
              type="button"
              onClick={() => stepBy(1)}
              disabled={quantity >= bounds.max}
              aria-label="Increase amount"
              className="h-10 w-10 rounded-control border border-hairline bg-surface-2 text-ink font-bold hover:bg-hairline flex-shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setShowUnitPicker(true)}
              className="flex-1 min-w-0 h-10 rounded-control border border-hairline bg-surface-2 px-3 flex items-center justify-between text-left hover:bg-hairline transition-colors"
            >
              <span className="text-body font-semibold text-ink truncate">{unit.label}</span>
              <ChevronDown className="h-4 w-4 text-ink-2 flex-shrink-0 ml-1" />
            </button>
          </div>
          {unit.key !== 'g' && (
            <p className="mt-1 text-caption text-ink-2 tabular-nums">= {Math.round(grams)}g total</p>
          )}
        </div>

        {/* Meal selector */}
        <div>
          <label className="block text-caption font-semibold uppercase tracking-caps text-ink-2 mb-1.5">Meal</label>
          <div className="grid grid-cols-4 gap-1.5">
            {MEAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMeal(opt.value)}
                className={`rounded-control border py-2 text-caption font-semibold transition-all active:scale-95 ${
                  meal === opt.value
                    ? 'border-brand bg-brand-soft text-brand-ink'
                    : 'border-hairline bg-surface-2 text-ink-2 hover:border-brand-ring'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Where — optional. Not a tracker, one field: it's what turns "some
            weeks are worse" into "restaurant days cost you 480 kcal". */}
        <div>
          <label className="block text-caption font-semibold uppercase tracking-caps text-ink-2 mb-1.5">
            Where <span className="font-medium normal-case tracking-normal text-ink-3">· optional</span>
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {MEAL_CONTEXTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setContext((c) => (c === value ? null : value))}
                aria-pressed={context === value}
                className={`rounded-control border py-2 text-micro font-semibold transition-all active:scale-95 ${
                  context === value
                    ? 'border-brand bg-brand-soft text-brand-ink'
                    : 'border-hairline bg-surface-2 text-ink-2 hover:border-brand-ring'
                }`}
              >
                {MEAL_CONTEXT_LABELS[value].emoji}
                <span className="mt-0.5 block">{MEAL_CONTEXT_LABELS[value].label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Nutrition preview */}
        {(hasFood || baseGrams > 0) && (
          <div className="grid grid-cols-4 gap-2 rounded-card border border-hairline bg-energy-soft px-3 py-2.5">
            <div className="text-center">
              <p className="text-body font-bold text-energy-ink tabular-nums">{Math.round(nutrition.kcal)}</p>
              <p className="text-micro text-energy-ink">kcal</p>
            </div>
            <div className="text-center">
              <p className="text-body font-bold tabular-nums" style={{ color: 'var(--protein)' }}>{Math.round(nutrition.protein)}g</p>
              <p className="text-micro text-ink-2">P</p>
            </div>
            <div className="text-center">
              <p className="text-body font-bold tabular-nums" style={{ color: 'var(--carbs)' }}>{Math.round(nutrition.carbs)}g</p>
              <p className="text-micro text-ink-2">C</p>
            </div>
            <div className="text-center">
              <p className="text-body font-bold tabular-nums" style={{ color: 'var(--fat)' }}>{Math.round(nutrition.fat)}g</p>
              <p className="text-micro text-ink-2">F</p>
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

        {/* Unit picker bottom sheet */}
        {showUnitPicker && (
          <UnitPicker
            foodName={food?.name ?? 'Food item'}
            units={units}
            selected={unit}
            onSelect={switchUnit}
            onClose={() => setShowUnitPicker(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
