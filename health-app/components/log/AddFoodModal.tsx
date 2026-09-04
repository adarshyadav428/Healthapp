'use client'

import { useMemo, useRef, useState } from 'react'
import type { Food, FoodLog } from '../../types/index'
import { useUser } from '../../hooks/useUser'
import { toast } from '../ui/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { getIstDayRange, dateStrToUtcMidnight } from '../../lib/dateUtils'
import { ArrowLeft, ChevronDown, Drumstick, Droplet, Wheat, Sprout, Loader2, Minus, Plus } from 'lucide-react'
import { reportLogMilestone } from '../../store/milestoneStore'
import type { LogMilestone } from '../../lib/logMilestones'
import { buildUnits, defaultPortionFor, quantityBounds, stepQuantity, normalizeQuantity, quantityOnUnitSwitch, isLiquidFood, type Unit } from '../../lib/portion-units'
import { mealForTime } from '../../lib/meal'
import { MEAL_CONTEXTS, MEAL_CONTEXT_LABELS, type MealContext } from '../../lib/mealContext'
import { logMetaHeaders } from '../../lib/posthog/client'
import { userFacingApiError } from '../../lib/apiError'
import { coachingLine, dayContextFor } from '../../lib/coaching'
import { useDailyTotals } from '../../hooks/useDailyTotals'
import { useScrollLock } from '../ui/use-scroll-lock'
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

export function AddFoodModal(
  { food, onClose, logDate, targets }: {
    food: Food
    onClose: () => void
    logDate?: string
    /**
     * The day's calorie + protein targets, so logging can answer with a
     * coaching sentence rather than just a number.
     *
     * `coachingLine` is pure, free and costs no AI call, but it was wired only
     * into useCameraScan and useChatLog — both behind the 3-call lifetime AI
     * trial. A free user logging by search, which is the overwhelming majority
     * of all logs, therefore never saw a coaching sentence in their life: the
     * app built its best retention asset and attached it to the one surface
     * almost nobody can reach (audit 2026-09-03, P1-13).
     *
     * Optional on purpose. BottomNav's barcode result and the onboarding
     * barcode step render this modal without a profile in hand; they simply get
     * no line, which is what coachingLine already returns when it can't speak.
     */
    targets?: { kcal: number; protein: number }
  }
) {
  const { user } = useUser()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inFlightRef = useRef(false)
  const queryClient = useQueryClient()

  // Scoped to the day being logged to, not "today" — backfilling a past day
  // must describe that day's budget. Same rule as useChatLog and useCameraScan,
  // pinned by tests/coachingWiring.test.ts.
  const totalsDate = useMemo(
    () => (logDate ? dateStrToUtcMidnight(logDate) : new Date()),
    [logDate]
  )
  const { totals: dailyTotals, isLoading: totalsLoading, error: totalsError } =
    useDailyTotals(user?.id ?? null, totalsDate)
  const dayContext = dayContextFor({
    totals: dailyTotals,
    isLoading: totalsLoading,
    error: totalsError,
  })

  const units = useMemo(() => buildUnits(food), [food])
  // Same helper the search row's "+" uses, so tapping through to this modal
  // and quick-adding log identical amounts of the same food.
  const initialPortion = useMemo(() => defaultPortionFor(food, units), [food, units])
  const [unit, setUnit] = useState<Unit>(() => initialPortion.unit)
  const [quantityStr, setQuantityStr] = useState(() => String(initialPortion.quantity))
  const [meal, setMeal] = useState<MealValue>(mealForTime())
  const [context, setContext] = useState<MealContext | null>(null)
  const [showUnitPicker, setShowUnitPicker] = useState(false)

  useScrollLock()

  const quantityNum = Math.max(0, parseFloat(quantityStr) || 0)
  const grams = unit.toGrams(quantityNum)
  // Drinkable liquids read in ml, not grams (density ~1, so the number is the same).
  const liquid = useMemo(() => isLiquidFood(food.name), [food.name])

  // Same granularity EditFoodLogModal uses: 10 g in gram mode, half a portion
  // otherwise, so the two amount editors behave identically. Both now read it
  // from lib/portion-units.ts rather than each keeping its own copy.
  const bounds = quantityBounds(unit)
  const stepBy = (dir: 1 | -1) => setQuantityStr(String(stepQuantity(quantityNum, dir, unit)))
  // Strip anything that isn't a digit or a dot: kills the minus key, `e`
  // notation and a pasted "-500" in one pass, while still allowing a
  // half-typed "1." and a momentarily empty field.
  const onQuantityChange = (raw: string) => setQuantityStr(raw.replace(/[^0-9.]/g, ''))
  // Leaving the field never leaves it broken: empty, zero and negative all
  // snap to the minimum rather than silently disabling the Add button.
  const onQuantityBlur = () => setQuantityStr(String(normalizeQuantity(quantityStr, unit)))

  // Switching between two household measures (katori → plate) keeps the number
  // the user typed. Switching to/from Grams re-expresses by weight, so "1
  // katori" → Grams can't silently become "1 gram". See quantityOnUnitSwitch.
  const switchUnit = (u: Unit) => {
    setQuantityStr(String(quantityOnUnitSwitch(unit, u, quantityNum)))
    setUnit(u)
    setShowUnitPicker(false)
  }

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

      // The day's totals as they stood BEFORE this meal — the same "consumed so
      // far" figure the camera and chat paths pass. Read before the cache write
      // above lands, and dayContextFor drops the context entirely while the
      // read is loading or failed rather than passing zeros through, so the
      // sentence can never promise a full budget to someone who has none left.
      const coaching = targets
        ? coachingLine(
            { kcal: nutrition.kcal, protein: nutrition.protein },
            { kcal: targets.kcal, protein: targets.protein },
            dayContext
          )
        : null

      toast({
        title: '✅ Food logged!',
        description: coaching ?? `${nutrition.kcal} kcal added to ${meal}`,
        duration: coaching ? 4000 : 2500,
      })
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
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-32">
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
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-ink-2 font-medium mb-1.5 px-1">Quantity</p>
              {/* Steppers so the common nudge (one more roti, half a katori
                  less) costs a tap instead of the number pad. */}
              <div className="flex h-12 items-center rounded-control bg-surface-2">
                <button
                  type="button"
                  onClick={() => stepBy(-1)}
                  disabled={quantityNum <= bounds.min}
                  aria-label="Decrease quantity"
                  className="flex h-12 w-10 shrink-0 items-center justify-center text-ink-2 tap-scale disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Minus className="h-4 w-4" strokeWidth={2.5} />
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
                  className="h-12 min-w-0 flex-1 bg-transparent px-1 text-center text-lg font-bold text-ink outline-none focus:ring-[3px] focus:ring-brand-ring rounded-control transition-all"
                />
                <button
                  type="button"
                  onClick={() => stepBy(1)}
                  disabled={quantityNum >= bounds.max}
                  aria-label="Increase quantity"
                  className="flex h-12 w-10 shrink-0 items-center justify-center text-ink-2 tap-scale disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs text-ink-2 font-medium mb-1.5 px-1">Measure</p>
              <button
                type="button"
                onClick={() => setShowUnitPicker(true)}
                className="w-full h-12 rounded-control bg-surface-2 px-3 flex items-center justify-between text-left transition-all hover:bg-hairline"
              >
                <span className="text-base font-bold text-ink truncate">{unit.label}</span>
                <ChevronDown className="h-4 w-4 text-ink-2 flex-shrink-0 ml-1" />
              </button>
            </div>
          </div>
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
              <p className="text-xs font-bold text-ink tabular-nums">{liquid ? 'Volume' : 'Net wt'}: {Math.round(grams)} {liquid ? 'ml' : 'g'}</p>
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
      {/* `safe-area-inset-bottom` used to be here and is not a class that
          exists — globals.css defines `.safe-area-bottom`. Renaming it would
          have *cut* the padding, since that utility resolves to
          `env(safe-area-inset-bottom)` = 0 without `viewport-fit=cover`; this
          matches BottomNav's idiom instead, keeping 20px today and picking the
          inset up if cover ever lands. */}
      <div
        className="absolute inset-x-0 bottom-0 bg-canvas border-t border-hairline px-4 pt-3"
        style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}
      >
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
          onSelect={switchUnit}
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
