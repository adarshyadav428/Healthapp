'use client'

import { useMemo, useRef, useState } from 'react'
import type { Food, FoodLog } from '../../types/index'
import { useUser } from '../../hooks/useUser'
import { useSubscription } from '../../hooks/useSubscription'
import { toast } from '../ui/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { getUtcDayRange } from '../../lib/dateUtils'
import Link from 'next/link'
import { X, Zap, Minus, Plus } from 'lucide-react'

const MEAL_OPTIONS = [
  { value: 'breakfast', label: '🥣 Breakfast' },
  { value: 'lunch',     label: '🍛 Lunch' },
  { value: 'dinner',    label: '🍲 Dinner' },
  { value: 'snack',     label: '🥜 Snack' },
] as const

type MealValue = (typeof MEAL_OPTIONS)[number]['value']

const round2 = (n: number) => Math.round(n * 100) / 100

function defaultMeal(): MealValue {
  const hour = new Date().getHours()
  if (hour < 11) return 'breakfast'
  if (hour < 16) return 'lunch'
  if (hour < 21) return 'dinner'
  return 'snack'
}

export function AddFoodModal({ food, onClose }: { food: Food; onClose: () => void }) {
  const { user } = useUser()
  const { data: subscription } = useSubscription(user?.id ?? null)
  const [showLimit, setShowLimit] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inFlightRef = useRef(false)
  const queryClient = useQueryClient()

  // Use string states so the user can freely clear and retype without NaN issues
  const servingSize = food.serving_size_g ?? 100
  const [gramsStr, setGramsStr] = useState(String(servingSize))
  const [servingsStr, setServingsStr] = useState('1')
  const [meal, setMeal] = useState<MealValue>(defaultMeal())

  const gramsNum = Math.max(0, parseFloat(gramsStr) || 0)

  // Keep grams and servings in sync without infinite loops
  const handleGramsChange = (val: string) => {
    setGramsStr(val)
    const g = parseFloat(val)
    if (servingSize > 0 && !isNaN(g) && g > 0) {
      const sv = g / servingSize
      setServingsStr(String(Math.round(sv * 100) / 100))
    }
  }

  const handleServingsChange = (val: string) => {
    setServingsStr(val)
    const sv = parseFloat(val)
    if (servingSize > 0 && !isNaN(sv) && sv > 0) {
      setGramsStr(String(Math.round(sv * servingSize)))
    }
  }

  const setServingsStep = (delta: number) => {
    const current = Math.max(0, parseFloat(servingsStr) || 0)
    const next = Math.max(0.5, Math.round((current + delta) * 4) / 4) // snap to 0.25 steps
    handleServingsChange(String(next))
  }

  const nutrition = useMemo(() => {
    const factor = gramsNum / 100
    return {
      kcal:    round2(food.kcal_per_100g      * factor),
      protein: round2(food.protein_g_per_100g * factor),
      carbs:   round2(food.carbs_g_per_100g   * factor),
      fat:     round2(food.fat_g_per_100g     * factor),
      fiber:   food.fiber_g_per_100g != null ? round2(food.fiber_g_per_100g * factor) : null,
    }
  }, [food, gramsNum])

  const SHORTCUTS = [
    { label: '½', sv: 0.5 },
    { label: '1×', sv: 1 },
    { label: '1½', sv: 1.5 },
    { label: '2×', sv: 2 },
  ]

  const handleSubmit = async () => {
    if (inFlightRef.current || isSubmitting) return
    if (gramsNum <= 0) {
      toast({ title: 'Enter a valid amount', description: 'Grams must be greater than 0', variant: 'error' })
      return
    }
    inFlightRef.current = true
    setIsSubmitting(true)
    try {
      if (!user) throw new Error('You must be signed in to log food.')

      // Free-plan gate: read today's count from TanStack Query cache
      if (!subscription?.isPro) {
        const { start } = getUtcDayRange()
        const cached = queryClient.getQueryData<FoodLog[]>(['food-logs', user.id, start])
        if (cached != null && cached.length >= 5) { setShowLimit(true); return }
      }

      const res = await fetch('/api/logs/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          food_id: food.id,
          meal,
          servings: 1,
          grams: gramsNum,
        }),
      })

      const body = await res.json().catch(() => ({} as { error?: string; row?: FoodLog }))

      if (!res.ok) {
        if (res.status === 402 || body?.error === 'Free limit reached') {
          setShowLimit(true)
          return
        }
        throw new Error(body?.error || 'Failed to log food')
      }

      // Optimistic cache update — avoid full re-fetch
      if (body.row) {
        const { start } = getUtcDayRange()
        queryClient.setQueryData<FoodLog[]>(['food-logs', user.id, start], (old = []) => [body.row, ...old])
      } else {
        queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      }

      toast({ title: '✅ Food logged!', description: `${Math.round(nutrition.kcal)} kcal added to ${meal}.`, duration: 2500 })
      onClose()
    } catch (err) {
      toast({ title: 'Failed to log food', description: (err as Error).message, variant: 'error', duration: 4000 })
    } finally {
      inFlightRef.current = false
      setIsSubmitting(false)
    }
  }

  const sheetClass = "relative w-full max-w-md rounded-t-3xl bg-white dark:bg-slate-900 p-5 shadow-2xl max-h-[92vh] overflow-y-auto"
  const handleBar = "absolute top-3 left-1/2 -translate-x-1/2 h-1 w-10 rounded-full bg-gray-200 dark:bg-slate-700"

  if (showLimit) {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className={sheetClass}>
          <div className={handleBar} />
          <div className="text-center pt-4">
            <div className="text-4xl mb-3">🔒</div>
            <h2 className="text-lg font-black text-foreground">Free limit reached</h2>
            <p className="mt-2 text-sm text-muted">You&apos;ve logged 5 items today. Upgrade to Pro for unlimited logging.</p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-border py-3 text-sm font-semibold text-foreground hover:bg-muted/10 transition-colors">Close</button>
              <Link href="/upgrade" className="flex-1 rounded-2xl bg-orange-600 py-3 text-sm font-bold text-white text-center hover:bg-orange-700 transition-colors">Upgrade to Pro</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop — use pointer-events so it doesn't interfere with inputs */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      <div className={sheetClass}>
        <div className={handleBar} />

        {/* Header */}
        <div className="flex items-start justify-between mb-4 mt-2">
          <div className="flex-1 min-w-0 pr-3">
            <h2 className="text-base font-black text-foreground truncate">{food.name}</h2>
            {food.brand && <p className="text-xs text-muted">{food.brand}</p>}
            {food.serving_description && (
              <p className="text-xs text-muted mt-0.5">
                1 serving = {food.serving_size_g}g
                {food.serving_description && food.serving_description !== `${food.serving_size_g}g`
                  ? ` (${food.serving_description})` : ''}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0">
            <X className="h-5 w-5 text-muted" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Meal selector */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Meal</p>
            <div className="grid grid-cols-4 gap-1.5">
              {MEAL_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMeal(m.value)}
                  className={`rounded-xl py-2 text-xs font-semibold transition-all ${
                    meal === m.value
                      ? 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700'
                      : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-100 dark:border-slate-700 hover:border-orange-200 dark:hover:border-orange-800'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount input — servings + grams linked */}
          <div>
            {/* Servings row */}
            <div className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
                Quantity{food.serving_description ? ` · 1 serving = ${food.serving_description}` : ''}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setServingsStep(-0.5)}
                  className="h-11 w-11 flex-shrink-0 rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 active:scale-95 transition-all"
                >
                  <Minus className="h-4 w-4 text-muted" />
                </button>
                <input
                  type="number"
                  inputMode="decimal"
                  value={servingsStr}
                  onChange={(e) => handleServingsChange(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="1"
                  className="flex-1 h-11 rounded-2xl border border-orange-200 dark:border-orange-800 bg-white dark:bg-slate-800 text-foreground text-center text-base font-bold outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setServingsStep(0.5)}
                  className="h-11 w-11 flex-shrink-0 rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 active:scale-95 transition-all"
                >
                  <Plus className="h-4 w-4 text-muted" />
                </button>
              </div>

              {/* Serving shortcuts */}
              <div className="flex gap-1.5 mt-2">
                {SHORTCUTS.map((s) => {
                  const activeSv = Math.round((parseFloat(servingsStr) || 0) * 100) / 100
                  return (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => handleServingsChange(String(s.sv))}
                      className={`flex-1 rounded-xl py-1.5 text-xs font-semibold border transition-all ${
                        activeSv === s.sv
                          ? 'bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700'
                          : 'bg-gray-50 dark:bg-slate-800 text-muted border-gray-100 dark:border-slate-700 hover:border-orange-200'
                      }`}
                    >
                      {s.label}
                      <span className="block text-[10px] opacity-60">{Math.round(s.sv * servingSize)}g</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Grams row — secondary, smaller */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">Or enter grams directly</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleGramsChange(String(Math.max(5, Math.round(gramsNum - 10))))}
                  className="h-9 w-9 flex-shrink-0 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 active:scale-95 transition-all"
                >
                  <Minus className="h-3.5 w-3.5 text-muted" />
                </button>
                <input
                  type="number"
                  inputMode="decimal"
                  value={gramsStr}
                  onChange={(e) => handleGramsChange(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className="flex-1 h-9 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-foreground text-center text-sm font-bold outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 transition-all"
                />
                <button
                  type="button"
                  onClick={() => handleGramsChange(String(Math.round(gramsNum + 10)))}
                  className="h-9 w-9 flex-shrink-0 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 active:scale-95 transition-all"
                >
                  <Plus className="h-3.5 w-3.5 text-muted" />
                </button>
                <span className="text-xs text-muted font-medium flex-shrink-0">g</span>
              </div>
            </div>
          </div>

          {/* Nutrition preview */}
          <div className="rounded-2xl border border-orange-100 dark:border-orange-900/30 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 p-4">
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-3xl font-black text-orange-700 dark:text-orange-400">{Math.round(nutrition.kcal)}</span>
              <span className="text-sm text-orange-400 dark:text-orange-500 font-semibold">kcal</span>
            </div>
            <div className={`grid gap-2 ${nutrition.fiber != null && nutrition.fiber > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
              <MacroChip value={nutrition.protein} label="Protein" color="bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" />
              <MacroChip value={nutrition.carbs}   label="Carbs"   color="bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" />
              <MacroChip value={nutrition.fat}     label="Fat"     color="bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" />
              {nutrition.fiber != null && nutrition.fiber > 0 && (
                <MacroChip value={nutrition.fiber} label="Fiber"   color="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" />
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || gramsNum <= 0}
            className="w-full rounded-2xl bg-orange-600 py-3.5 text-sm font-bold text-white hover:bg-orange-700 active:scale-[.98] transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Zap className="h-4 w-4" />
            {isSubmitting ? 'Logging...' : `Log ${Math.round(nutrition.kcal)} kcal`}
          </button>
        </div>
      </div>
    </div>
  )
}

function MacroChip({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className={`rounded-xl ${color} py-2 text-center`}>
      <p className="text-sm font-black">{value}g</p>
      <p className="text-[10px] font-semibold opacity-75">{label}</p>
    </div>
  )
}
