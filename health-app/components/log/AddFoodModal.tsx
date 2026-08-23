'use client'

import { useMemo, useRef, useState } from 'react'
import type { Food, FoodLog } from '../../types/index'
import { useUser } from '../../hooks/useUser'
import { toast } from '../ui/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { getIstDayRange, dateStrToUtcMidnight } from '../../lib/dateUtils'
import { ArrowLeft, ChevronDown, Drumstick, Droplet, Wheat, Sprout, Loader2 } from 'lucide-react'
import { reportLogMilestone } from '../../store/milestoneStore'
import type { LogMilestone } from '../../lib/logMilestones'
import { buildUnits, pickDefaultUnit, quantityBounds, stepQuantity, normalizeQuantity, type Unit } from '../../lib/portion-units'
import { mealForTime } from '../../lib/meal'
import { MEAL_CONTEXTS, MEAL_CONTEXT_LABELS, type MealContext } from '../../lib/mealContext'
import { logMetaHeaders } from '../../lib/posthog/client'
import { userFacingApiError } from '../../lib/apiError'
import { UnitPicker } from './UnitPicker'

const MEAL_OPTIONS = [
  { value: 'breakfast', label: 'Breakfast', emoji: '🥣' },
  { value: 'lunch',     label: 'Lunch',     emoji: '🍛' },
  { value: 'dinner',    label: 'Dinner',    emoji: '🍲' },
  { value: 'snack',     label: 'Snack',     emoji: '🥜' },
] as const

type MealValue = (typeof MEAL_OPTIONS)[number]['value']

const round1 = (n: number) => Math.round(n * 10) / 10

/** Pick an emoji based on the food name — fallback when we have no real image. */
function foodEmoji(name: string): string {
  const n = name.toLowerCase()
  if (/rice|chawal|biryani|pulao|khichdi/.test(n)) return '🍚'
  if (/roti|chapati|naan|paratha|bhatura|puri|thepla|makki/.test(n)) return '🫓'
  if (/dal|lentil|sambh?ar|rasam/.test(n)) return '🥣'
  if (/chicken|murgh|tandoori/.test(n)) return '🍗'
  if (/egg|anda|omelette|bhurji/.test(n)) return '🥚'
  if (/fish|machli|prawn|jhinga|rohu/.test(n)) return '🐟'
  if (/mutton|gosht/.test(n)) return '🍖'
  if (/paneer|cheese/.test(n)) return '🧀'
  if (/milk|lassi|chaas|dahi|curd|kheer/.test(n)) return '🥛'
  if (/idli|dosa|uttapam|appam|vada|puttu/.test(n)) return '🥞'
  if (/samosa|kachori|pakora/.test(n)) return '🥟'
  if (/pav|bhaji|momo/.test(n)) return '🥖'
  if (/gulab|jalebi|ladoo|barfi|halwa|peda|rasgulla/.test(n)) return '🍰'
  if (/banana|kela/.test(n)) return '🍌'
  if (/mango|aam/.test(n)) return '🥭'
  if (/apple/.test(n)) return '🍎'
  if (/watermelon|tarbooz/.test(n)) return '🍉'
  if (/grape|angoor/.test(n)) return '🍇'
  if (/coconut|nariyal/.test(n)) return '🥥'
  if (/almond|cashew|peanut|walnut|badam|kaju|moongfali/.test(n)) return '🥜'
  if (/tea|chai|coffee/.test(n)) return '☕'
  if (/water|juice|nimbu|panna/.test(n)) return '🥤'
  if (/aloo|potato|sabzi|vegetable|gobi|palak|bhindi|baingan|lauki|karela|methi/.test(n)) return '🥗'
  if (/oil|ghee|butter/.test(n)) return '🧈'
  if (/sugar|honey|jaggery|gur|shahad/.test(n)) return '🍯'
  if (/biscuit|maggi|noodle/.test(n)) return '🍪'
  return '🍽️'
}

export function AddFoodModal({ food, onClose, logDate }: { food: Food; onClose: () => void; logDate?: string }) {
  const { user } = useUser()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inFlightRef = useRef(false)
  const queryClient = useQueryClient()

  const units = useMemo(() => buildUnits(food), [food])
  const [unit, setUnit] = useState<Unit>(() => pickDefaultUnit(units, food))
  const [quantityStr, setQuantityStr] = useState('1')
  const [meal, setMeal] = useState<MealValue>(mealForTime())
  const [context, setContext] = useState<MealContext | null>(null)
  const [showUnitPicker, setShowUnitPicker] = useState(false)

  const quantityNum = Math.max(0, parseFloat(quantityStr) || 0)
  const grams = unit.toGrams(quantityNum)

  // − / + stepper — whole units per tap, bounded by the server's grams cap.
  const bounds = quantityBounds(unit)
  const stepBy = (dir: 1 | -1) => setQuantityStr(String(stepQuantity(quantityNum, dir, unit)))
  // Strip anything that isn't a digit or a dot: kills the minus key, `e`
  // notation and a pasted "-500" in one pass, while still allowing a
  // half-typed "1." and a momentarily empty field.
  const onQuantityChange = (raw: string) => setQuantityStr(raw.replace(/[^0-9.]/g, ''))
  // Leaving the field never leaves it broken: empty/zero snaps to the minimum.
  const onQuantityBlur = () => setQuantityStr(String(normalizeQuantity(quantityStr, unit)))

  const nutrition = useMemo(() => {
    const factor = grams / 100
    return {
      kcal:    Math.round(food.kcal_per_100g      * factor),
      protein: round1(food.protein_g_per_100g * factor),
      carbs:   round1(food.carbs_g_per_100g   * factor),
      fat:     round1(food.fat_g_per_100g     * factor),
      fiber:   food.fiber_g_per_100g != null ? round1(food.fiber_g_per_100g * factor) : null,
    }
  }, [food, grams])

  const handleSubmit = async () => {
    if (inFlightRef.current || isSubmitting) return
    if (grams <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'error' })
      return
    }
    inFlightRef.current = true
    setIsSubmitting(true)
    try {
      if (!user) throw new Error('You must be signed in to log food.')

      const res = await fetch('/api/logs/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...logMetaHeaders('search') },
        body: JSON.stringify({
          food_id: food.id,
          meal,
          servings: 1,
          grams,
          date: logDate,
          context,
        }),
      })

      const body = (await res.json().catch(() => ({}))) as { error?: string; row?: FoodLog; milestone?: LogMilestone }

      // 4xx is a validation message written for a person; 5xx is a Postgres
      // string written for us. See lib/apiError.ts.
      if (!res.ok) throw new Error(userFacingApiError(res.status, body?.error, 'Could not log this food.'))

      // API now returns the full inserted row — update cache instantly (no refetch needed).
      // Key by the day the entry belongs to (the viewed day when backfilling).
      if (body.row) {
        const { start } = getIstDayRange(logDate ? dateStrToUtcMidnight(logDate) : new Date())
        queryClient.setQueryData<FoodLog[]>(['food-logs', user.id, start], (old = []) => [body.row as FoodLog, ...(old ?? [])])
      } else {
        queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      }

      toast({ title: '✅ Food logged!', description: `${nutrition.kcal} kcal added to ${meal}`, duration: 2500 })
      reportLogMilestone(body.milestone)
      onClose()
    } catch (err) {
      toast({ title: 'Failed to log food', description: (err as Error).message, variant: 'error', duration: 4000 })
    } finally {
      inFlightRef.current = false
      setIsSubmitting(false)
    }
  }

  const emoji = foodEmoji(food.name)

  return (
    <div className="fixed inset-0 z-50 bg-canvas flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="h-10 w-10 rounded-full flex items-center justify-center hover:bg-surface-2 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-ink" />
        </button>
        <div className="h-10 w-10" />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        {/* Hero card */}
        <div className="relative rounded-sheet overflow-hidden h-44 mb-5 bg-brand-soft">
          <div className="absolute inset-0 flex items-center justify-center text-7xl opacity-90">
            {emoji}
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent px-4 py-3">
            <p className="text-white text-lg font-bold leading-tight">{food.name}</p>
            {food.brand && <p className="text-white/80 text-xs font-medium">{food.brand}</p>}
          </div>
        </div>

        {/* Quantity + Measure */}
        <div className="rounded-card bg-surface border border-hairline p-3 mb-6">
          <p className="text-xs text-ink-2 font-medium mb-1.5 px-1">Quantity</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => stepBy(-1)}
              disabled={quantityNum <= bounds.min}
              aria-label="Decrease quantity"
              className="h-12 w-12 flex-shrink-0 rounded-control bg-surface-2 text-xl font-bold text-ink hover:bg-hairline active:scale-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
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
              placeholder="1"
              className="flex-1 min-w-0 h-12 rounded-control bg-surface-2 px-3 text-center text-lg font-bold text-ink tabular-nums outline-none focus:ring-[3px] focus:ring-brand-ring transition-all"
            />
            <button
              type="button"
              onClick={() => stepBy(1)}
              disabled={quantityNum >= bounds.max}
              aria-label="Increase quantity"
              className="h-12 w-12 flex-shrink-0 rounded-control bg-surface-2 text-xl font-bold text-ink hover:bg-hairline active:scale-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              +
            </button>
          </div>

          <p className="text-xs text-ink-2 font-medium mb-1.5 mt-3 px-1">Measure</p>
          <button
            type="button"
            onClick={() => setShowUnitPicker(true)}
            className="w-full h-12 rounded-control bg-surface-2 px-3 flex items-center justify-between text-left transition-all hover:bg-hairline"
          >
            <span className="text-base font-bold text-ink truncate">{unit.label}</span>
            <ChevronDown className="h-4 w-4 text-ink-2 flex-shrink-0 ml-1" />
          </button>
        </div>

        {/* Macronutrients Breakdown */}
        <p className="font-display text-base font-bold text-ink mb-3 px-1">Macronutrients Breakdown</p>

        <div className="rounded-card bg-surface border border-hairline p-4 mb-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-ink-2 font-medium">Calories</p>
              <p className="font-display text-3xl font-bold text-ink mt-0.5 tabular-nums">
                {nutrition.kcal} <span className="text-base font-bold text-ink-2">Cal</span>
              </p>
            </div>
            <div className="bg-surface-2 rounded-control px-3 py-1.5">
              <p className="text-xs font-bold text-ink tabular-nums">Net wt: {Math.round(grams)} g</p>
            </div>
          </div>

          <div className="border-t border-hairline" />

          <div className="divide-y divide-hairline">
            <MacroRow icon={<Drumstick className="h-4 w-4" />} color="var(--protein)" label="Proteins" value={nutrition.protein} />
            <MacroRow icon={<Droplet    className="h-4 w-4" />} color="var(--fat)"     label="Fats"     value={nutrition.fat} />
            <MacroRow icon={<Wheat      className="h-4 w-4" />} color="var(--carbs)"   label="Carbs"    value={nutrition.carbs} />
            {nutrition.fiber != null && (
              <MacroRow icon={<Sprout className="h-4 w-4" />} color="var(--good)" label="Fiber" value={nutrition.fiber} />
            )}
          </div>
        </div>

        {/* Meal selector */}
        <p className="font-display text-base font-bold text-ink mb-3 px-1">Meal</p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {MEAL_OPTIONS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMeal(m.value)}
              className={`rounded-control py-2.5 flex flex-col items-center gap-1 transition-all border ${
                meal === m.value
                  ? 'bg-brand-soft border-brand text-brand-ink'
                  : 'bg-surface border-hairline text-ink-2 hover:border-brand-ring'
              }`}
            >
              <span className="text-lg leading-none">{m.emoji}</span>
              <span className="text-[11px] font-bold">{m.label}</span>
            </button>
          ))}
        </div>

        {/* Where — optional. Left null unless tapped: the Trends insight compares
            days that have a context against days that don't, so a guessed value
            is worse than no value. Tapping the selected chip clears it again. */}
        <p className="font-display text-base font-bold text-ink mb-1 px-1">
          Where? <span className="text-xs font-normal text-ink-2">Optional</span>
        </p>
        <p className="text-xs text-ink-2 mb-3 px-1">Helps spot why some weeks run heavier.</p>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {MEAL_CONTEXTS.map((c) => {
            const meta = MEAL_CONTEXT_LABELS[c]
            const selected = context === c
            return (
              <button
                key={c}
                type="button"
                aria-pressed={selected}
                onClick={() => setContext(selected ? null : c)}
                className={`rounded-control py-2.5 flex flex-col items-center gap-1 transition-all border ${
                  selected
                    ? 'bg-brand-soft border-brand text-brand-ink'
                    : 'bg-surface border-hairline text-ink-2 hover:border-brand-ring'
                }`}
              >
                <span className="text-lg leading-none">{meta.emoji}</span>
                <span className="text-[11px] font-bold">{meta.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Sticky bottom Add button */}
      <div className="absolute inset-x-0 bottom-0 bg-canvas border-t border-hairline px-4 pt-3 pb-5 safe-area-inset-bottom">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || grams <= 0}
          className="w-full rounded-control bg-brand hover:opacity-90 active:scale-[.98] py-4 text-base font-bold text-white transition-all shadow-float disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Adding...</span>
            </>
          ) : (
            <span>Add</span>
          )}
        </button>
      </div>

      {/* Unit picker bottom sheet */}
      {showUnitPicker && (
        <UnitPicker
          foodName={food.name}
          units={units}
          selected={unit}
          onSelect={(u) => { setUnit(u); setShowUnitPicker(false) }}
          onClose={() => setShowUnitPicker(false)}
        />
      )}
    </div>
  )
}

function MacroRow({ icon, color, label, value }: { icon: React.ReactNode; color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <span style={{ color }}>{icon}</span>
        <span className="text-sm font-bold text-ink">{label}</span>
      </div>
      <span className="text-sm font-bold text-ink tabular-nums">{value} g</span>
    </div>
  )
}
