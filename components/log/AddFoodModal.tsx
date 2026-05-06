'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Food } from '../../types/index'
import { getBrowserSupabaseClient } from '../../lib/supabase/client'
import { useUser } from '../../hooks/useUser'
import { useSubscription } from '../../hooks/useSubscription'
import { toast } from '../ui/use-toast'
import { addFoodSchema, type AddFoodData } from '../../lib/validations'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { X, Zap } from 'lucide-react'

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

  const form = useForm<AddFoodData>({
    resolver: zodResolver(addFoodSchema),
    defaultValues: { food_id: food.id, meal: defaultMeal(), servings: 1, grams: food.serving_size_g },
  })

  const foodId = food.id
  useEffect(() => {
    form.reset({ food_id: foodId, meal: defaultMeal(), servings: 1, grams: food.serving_size_g })
  }, [foodId]) // eslint-disable-line react-hooks/exhaustive-deps

  const grams = form.watch('grams')
  const servings = form.watch('servings')
  const meal = form.watch('meal')

  const nutrition = useMemo(() => {
    const factor = (grams || 0) / 100
    const s = servings || 1
    return {
      kcal:    round2(food.kcal_per_100g      * factor * s),
      protein: round2(food.protein_g_per_100g * factor * s),
      carbs:   round2(food.carbs_g_per_100g   * factor * s),
      fat:     round2(food.fat_g_per_100g     * factor * s),
      fiber:   food.fiber_g_per_100g != null ? round2(food.fiber_g_per_100g * factor * s) : null,
    }
  }, [food, grams, servings])

  const handleSubmit = async (values: AddFoodData) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setIsSubmitting(true)
    try {
      if (!user) throw new Error('You must be signed in to log food.')
      const supabase = getBrowserSupabaseClient()
      const today = new Date()
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString()
      const endDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1)).toISOString()
      const { count, error: countError } = await supabase
        .from('food_logs').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).gte('logged_at', start).lt('logged_at', endDate)
      if (countError) throw new Error(countError.message)
      if (!subscription?.isPro && (count ?? 0) >= 5) { setShowLimit(true); return }
      const { error } = await supabase.from('food_logs').insert({
        user_id: user.id, food_id: food.id, meal: values.meal,
        servings: values.servings, grams: values.grams,
        kcal: nutrition.kcal, protein_g: nutrition.protein, carbs_g: nutrition.carbs, fat_g: nutrition.fat,
        logged_at: new Date().toISOString(),
      })
      if (error) throw new Error(error.message)
      toast({ title: '✅ Food logged!', description: 'Nice job staying consistent.', duration: 2500 })
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
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
  const inputClass = "w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2.5 text-sm font-bold text-foreground outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 transition-all text-center"

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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className={sheetClass}>
        <div className={handleBar} />

        {/* Header */}
        <div className="flex items-start justify-between mb-4 mt-2">
          <div className="flex-1 min-w-0 pr-3">
            <h2 className="text-base font-black text-foreground truncate">{food.name}</h2>
            {food.brand && <p className="text-xs text-muted">{food.brand}</p>}
            {food.serving_description && (
              <p className="text-xs text-muted mt-0.5">1 serving = {food.serving_size_g}g ({food.serving_description})</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0">
            <X className="h-5 w-5 text-muted" />
          </button>
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <input type="hidden" {...form.register('food_id')} />

          {/* Meal selector */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">Meal</p>
            <div className="grid grid-cols-4 gap-1.5">
              {MEAL_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => form.setValue('meal', m.value, { shouldValidate: true })}
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

          {/* Serving + grams */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">Serving size (g)</label>
              <input type="number" step="0.1" min="1" {...form.register('grams', { valueAsNumber: true })} className={inputClass} />
              {form.formState.errors.grams && <p className="mt-1 text-xs text-red-500">{form.formState.errors.grams.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1">Servings</label>
              <input type="number" step="0.25" min="0.25" {...form.register('servings', { valueAsNumber: true })} className={inputClass} />
              {form.formState.errors.servings && <p className="mt-1 text-xs text-red-500">{form.formState.errors.servings.message}</p>}
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
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-orange-600 py-3.5 text-sm font-bold text-white hover:bg-orange-700 active:scale-[.98] transition-all shadow-md disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Zap className="h-4 w-4" />
            {isSubmitting ? 'Logging...' : 'Log food'}
          </button>
        </form>
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
