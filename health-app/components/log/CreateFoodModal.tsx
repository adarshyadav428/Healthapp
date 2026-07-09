'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { customFoodSchema, type CustomFoodData } from '../../lib/validations'
import type { Food } from '../../types/index'
import { toast } from '../ui/use-toast'
import { X, ChefHat } from 'lucide-react'

const round2 = (n: number) => Math.round(n * 100) / 100

export function CreateFoodModal({
  initialName = '',
  onClose,
  onCreated,
}: {
  initialName?: string
  onClose: () => void
  onCreated: (food: Food) => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<CustomFoodData>({
    resolver: zodResolver(customFoodSchema),
    defaultValues: {
      name: initialName,
      brand: '',
      serving_size_g: 100,
      serving_description: '100g',
      kcal_per_100g: 0,
      protein_g_per_100g: 0,
      carbs_g_per_100g: 0,
      fat_g_per_100g: 0,
      fiber_g_per_100g: undefined,
    },
  })

  const serving = form.watch('serving_size_g') || 100
  const kcal = form.watch('kcal_per_100g') || 0
  const protein = form.watch('protein_g_per_100g') || 0
  const carbs = form.watch('carbs_g_per_100g') || 0
  const fat = form.watch('fat_g_per_100g') || 0

  const perServing = useMemo(() => {
    const factor = serving / 100
    return {
      kcal: round2(kcal * factor),
      protein: round2(protein * factor),
      carbs: round2(carbs * factor),
      fat: round2(fat * factor),
    }
  }, [serving, kcal, protein, carbs, fat])

  const onSubmit = async (values: CustomFoodData) => {
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/foods/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      const json = await res.json()
      if (res.status === 402) {
        window.location.href = '/upgrade?reason=custom_foods'
        return
      }
      if (!res.ok) throw new Error(json.error ?? 'Failed to create food')
      toast({ title: 'Custom food created!', description: 'Now log it from search.', duration: 3000 })
      onCreated(json.food as Food)
    } catch (err) {
      toast({ title: 'Failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-100">
              <ChefHat className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground">Create custom food</h2>
              <p className="text-xs text-muted">Add your own recipe or meal</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-muted" />
          </button>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Name + brand */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1 uppercase tracking-wide">Food name *</label>
              <input
                {...form.register('name')}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-foreground outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                placeholder="e.g. Dal Makhani"
              />
              {form.formState.errors.name && (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1 uppercase tracking-wide">Brand / Restaurant (optional)</label>
              <input
                {...form.register('brand')}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-foreground outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                placeholder="e.g. Home cooked"
              />
            </div>
          </div>

          {/* Serving */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted mb-1 uppercase tracking-wide">Serving size (g) *</label>
              <input
                type="number"
                step="1"
                {...form.register('serving_size_g', { valueAsNumber: true })}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-foreground outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                placeholder="100"
              />
              {form.formState.errors.serving_size_g && (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.serving_size_g.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted mb-1 uppercase tracking-wide">Serving label</label>
              <input
                {...form.register('serving_description')}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-foreground outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                placeholder="1 bowl"
              />
            </div>
          </div>

          {/* Macros per 100g */}
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Nutrition per 100g *</p>
            <div className="grid grid-cols-2 gap-3">
              <NutrientField label="Calories (kcal)" placeholder="250" color="border-orange-200 focus:border-orange-400 focus:ring-orange-100" {...form.register('kcal_per_100g', { valueAsNumber: true })} error={form.formState.errors.kcal_per_100g?.message} />
              <NutrientField label="Protein (g)" placeholder="15" color="border-blue-200 focus:border-blue-400 focus:ring-blue-100" {...form.register('protein_g_per_100g', { valueAsNumber: true })} error={form.formState.errors.protein_g_per_100g?.message} />
              <NutrientField label="Carbs (g)" placeholder="30" color="border-amber-200 focus:border-amber-400 focus:ring-amber-100" {...form.register('carbs_g_per_100g', { valueAsNumber: true })} error={form.formState.errors.carbs_g_per_100g?.message} />
              <NutrientField label="Fat (g)" placeholder="10" color="border-rose-200 focus:border-rose-400 focus:ring-rose-100" {...form.register('fat_g_per_100g', { valueAsNumber: true })} error={form.formState.errors.fat_g_per_100g?.message} />
            </div>
            <div className="mt-3">
              <NutrientField label="Fibre (g, optional)" placeholder="5" color="border-emerald-200 focus:border-emerald-400 focus:ring-emerald-100" {...form.register('fiber_g_per_100g', { valueAsNumber: true })} error={form.formState.errors.fiber_g_per_100g?.message} />
            </div>
          </div>

          {/* Per-serving preview */}
          {kcal > 0 && (
            <div className="rounded-2xl border border-orange-100 bg-orange-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600 mb-2">Per serving ({serving}g)</p>
              <div className="flex gap-4">
                <MiniStat value={perServing.kcal} label="kcal" color="text-orange-700 font-black text-lg" />
                <MiniStat value={perServing.protein} label="P" color="text-blue-600 font-bold" />
                <MiniStat value={perServing.carbs} label="C" color="text-amber-600 font-bold" />
                <MiniStat value={perServing.fat} label="F" color="text-rose-600 font-bold" />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-orange-600 py-3 text-sm font-bold text-white hover:bg-orange-700 active:scale-[.98] transition-all shadow-sm disabled:opacity-60"
          >
            {isSubmitting ? 'Creating...' : 'Create food & log it'}
          </button>
        </form>
      </div>
    </div>
  )
}

function NutrientField({
  label, placeholder, color, error, ...props
}: {
  label: string
  placeholder: string
  color: string
  error?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">{label}</label>
      <input
        type="number"
        step="0.1"
        min="0"
        placeholder={placeholder}
        className={`w-full rounded-xl border bg-gray-50 px-3 py-2 text-sm text-foreground outline-none focus:ring-2 transition-all ${color}`}
        {...props}
      />
      {error && <p className="mt-0.5 text-[10px] text-red-500">{error}</p>}
    </div>
  )
}

function MiniStat({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="text-center">
      <p className={color}>{value}</p>
      <p className="text-[10px] text-orange-400">{label}</p>
    </div>
  )
}
