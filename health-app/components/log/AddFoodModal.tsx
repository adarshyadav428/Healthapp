'use client'

import { useEffect, useMemo, useState } from 'react'
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

  useEffect(() => {
    form.reset({
      food_id: food.id,
      meal: 'breakfast',
      servings: 1,
      grams: food.serving_size_g,
    })
  }, [food, form])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showLimit, setShowLimit] = useState(false)
  const queryClient = useQueryClient()

  const grams = form.watch('grams')
  const servings = form.watch('servings')

  const nutrition = useMemo(() => {
    const factor = grams / 100
    return {
      kcal: food.kcal_per_100g * factor * servings,
      protein: food.protein_g_per_100g * factor * servings,
      carbs: food.carbs_g_per_100g * factor * servings,
      fat: food.fat_g_per_100g * factor * servings,
    }
  }, [food, grams, servings])

  const handleSubmit = async (values: AddFoodData) => {
    try {
      if (!user) throw new Error('You must be signed in to log food.')
      setIsSubmitting(true)

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
        setIsSubmitting(false)
        return
      }

      const { error } = await supabase.from('food_logs').insert({
        user_id: user.id,
        food_id: food.id,
        meal: values.meal,
        servings: values.servings,
        grams: values.grams,
        kcal: nutrition.kcal,
        protein_g: nutrition.protein,
        carbs_g: nutrition.carbs,
        fat_g: nutrition.fat,
        logged_at: new Date().toISOString(),
      })

      if (error) throw new Error(error.message)

      toast({ title: 'Food logged', description: 'Nice job staying consistent.' })
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      onClose()
    } catch (err) {
      toast({ title: 'Failed to log food', description: (err as Error).message, variant: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
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

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
            <p>{Math.round(nutrition.kcal)} kcal</p>
            <p>Protein: {Math.round(nutrition.protein)}g</p>
            <p>Carbs: {Math.round(nutrition.carbs)}g</p>
            <p>Fat: {Math.round(nutrition.fat)}g</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={form.handleSubmit(handleSubmit)} disabled={isSubmitting}>
            {isSubmitting ? 'Logging...' : 'Log Food'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {showLimit ? (
        <Dialog open onOpenChange={() => setShowLimit(false)}>
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
      ) : null}
    </Dialog>
  )
}
