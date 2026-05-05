'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Food } from '../../types/index'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { getBrowserSupabaseClient } from '../../lib/supabase/client'
import { useUser } from '../../hooks/useUser'
import { useSubscription } from '../../hooks/useSubscription'
import { toast } from '../ui/use-toast'
import { addFoodSchema, type AddFoodData } from '../../lib/validations'
import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'

const mealOptions = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
] as const

type MealValue = (typeof mealOptions)[number]['value']

const round2 = (n: number) => Math.round(n * 100) / 100

export function AddFoodModal({ food, onClose }: { food: Food; onClose: () => void }) {
  const { user } = useUser()
  const { data: subscription } = useSubscription(user?.id ?? null)
  const form = useForm<AddFoodData>({
    resolver: zodResolver(addFoodSchema),
    defaultValues: {
      food_id: food.id,
      meal: 'breakfast',
      servings: 1,
      grams: food.serving_size_g,
    },
  })

  // Stable food.id dep so reset only fires when food actually changes
  const foodId = food.id
  useEffect(() => {
    form.reset({
      food_id: foodId,
      meal: 'breakfast',
      servings: 1,
      grams: food.serving_size_g,
    })
  }, [foodId]) // eslint-disable-line react-hooks/exhaustive-deps

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showLimit, setShowLimit] = useState(false)
  // Guard against double-submit in the tiny window before React re-renders
  const inFlightRef = useRef(false)
  const queryClient = useQueryClient()

  const grams = form.watch('grams')
  const servings = form.watch('servings')

  const nutrition = useMemo(() => {
    const factor = (grams || 0) / 100
    const s = servings || 1
    return {
      kcal:    round2(food.kcal_per_100g    * factor * s),
      protein: round2(food.protein_g_per_100g * factor * s),
      carbs:   round2(food.carbs_g_per_100g   * factor * s),
      fat:     round2(food.fat_g_per_100g     * factor * s),
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
        .from('food_logs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('logged_at', start)
        .lt('logged_at', endDate)

      if (countError) throw new Error(countError.message)

      if (!subscription?.isPro && (count ?? 0) >= 5) {
        setShowLimit(true)
        return
      }

      const { error } = await supabase.from('food_logs').insert({
        user_id: user.id,
        food_id: food.id,
        meal: values.meal,
        servings: values.servings,
        grams: values.grams,
        kcal:      nutrition.kcal,
        protein_g: nutrition.protein,
        carbs_g:   nutrition.carbs,
        fat_g:     nutrition.fat,
        logged_at: new Date().toISOString(),
      })

      if (error) throw new Error(error.message)

      toast({ title: 'Food logged', description: 'Nice job staying consistent.', duration: 3000 })
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      onClose()
    } catch (err) {
      toast({ title: 'Failed to log food', description: (err as Error).message, variant: 'error', duration: 4000 })
    } finally {
      inFlightRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{food.name}</DialogTitle>
            <DialogDescription>{food.brand ?? 'Generic'}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <input type="hidden" {...form.register('food_id')} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="grams">Serving size (g)</Label>
                <Input
                  id="grams"
                  type="number"
                  step="0.1"
                  min="1"
                  {...form.register('grams', { valueAsNumber: true })}
                />
                {form.formState.errors.grams ? (
                  <p className="mt-1 text-xs text-red-500">{form.formState.errors.grams.message}</p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="servings">Servings</Label>
                <Input
                  id="servings"
                  type="number"
                  step="0.25"
                  min="0.25"
                  {...form.register('servings', { valueAsNumber: true })}
                />
                {form.formState.errors.servings ? (
                  <p className="mt-1 text-xs text-red-500">{form.formState.errors.servings.message}</p>
                ) : null}
              </div>
            </div>

            <div>
              <Label>Meal</Label>
              <Select
                value={form.watch('meal')}
                onValueChange={(value) => form.setValue('meal', value as MealValue, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {mealOptions.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.meal ? (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.meal.message}</p>
              ) : null}
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-baseline gap-1 mb-3">
                <span className="text-2xl font-black text-gray-900">{Math.round(nutrition.kcal)}</span>
                <span className="text-sm text-gray-500">kcal</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-blue-50 py-2">
                  <p className="text-sm font-bold text-blue-700">{nutrition.protein}g</p>
                  <p className="text-xs text-blue-500">Protein</p>
                </div>
                <div className="rounded-lg bg-amber-50 py-2">
                  <p className="text-sm font-bold text-amber-700">{nutrition.carbs}g</p>
                  <p className="text-xs text-amber-500">Carbs</p>
                </div>
                <div className="rounded-lg bg-rose-50 py-2">
                  <p className="text-sm font-bold text-rose-700">{nutrition.fat}g</p>
                  <p className="text-xs text-rose-500">Fat</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={form.handleSubmit(handleSubmit)} disabled={isSubmitting}>
              {isSubmitting ? 'Logging...' : 'Log Food'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Limit dialog rendered at sibling level — not nested — to avoid focus/portal conflicts */}
      <Dialog open={showLimit} onOpenChange={() => setShowLimit(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade to keep logging</DialogTitle>
            <DialogDescription>
              You&apos;ve logged 5 meals today. Upgrade to Pro for unlimited logs.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowLimit(false)}>Close</Button>
            <Button asChild>
              <Link href="/upgrade">Upgrade for $9.99/mo</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
