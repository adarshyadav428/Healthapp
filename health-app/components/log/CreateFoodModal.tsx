'use client'

import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { customFoodSchema, type CustomFoodData } from '../../lib/validations'
import type { Food } from '../../types/index'
import { toast } from '../ui/use-toast'
import { Sheet, SheetContent } from '../ui/sheet'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
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
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent title="Create a custom food" className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-control bg-brand-soft">
              <ChefHat className="h-5 w-5 text-brand" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-ink">Create custom food</h2>
              <p className="text-xs text-ink-2">Add your own recipe or meal</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-surface-2 transition-colors">
            <X className="h-5 w-5 text-ink-2" />
          </button>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Name + brand */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1 uppercase tracking-wide">Food name *</label>
              <Input {...form.register('name')} placeholder="e.g. Dal Makhani" />
              {form.formState.errors.name && (
                <p className="mt-1 text-xs text-danger">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1 uppercase tracking-wide">Brand / Restaurant (optional)</label>
              <Input {...form.register('brand')} placeholder="e.g. Home cooked" />
            </div>
          </div>

          {/* Serving */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1 uppercase tracking-wide">Serving size (g) *</label>
              <Input type="number" step="1" {...form.register('serving_size_g', { valueAsNumber: true })} placeholder="100" />
              {form.formState.errors.serving_size_g && (
                <p className="mt-1 text-xs text-danger">{form.formState.errors.serving_size_g.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-2 mb-1 uppercase tracking-wide">Serving label</label>
              <Input {...form.register('serving_description')} placeholder="1 bowl" />
            </div>
          </div>

          {/* Macros per 100g */}
          <div>
            <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-2">Nutrition per 100g *</p>
            <div className="grid grid-cols-2 gap-3">
              <NutrientField label="Calories (kcal)" placeholder="250" {...form.register('kcal_per_100g', { valueAsNumber: true })} error={form.formState.errors.kcal_per_100g?.message} />
              <NutrientField label="Protein (g)" placeholder="15" {...form.register('protein_g_per_100g', { valueAsNumber: true })} error={form.formState.errors.protein_g_per_100g?.message} />
              <NutrientField label="Carbs (g)" placeholder="30" {...form.register('carbs_g_per_100g', { valueAsNumber: true })} error={form.formState.errors.carbs_g_per_100g?.message} />
              <NutrientField label="Fat (g)" placeholder="10" {...form.register('fat_g_per_100g', { valueAsNumber: true })} error={form.formState.errors.fat_g_per_100g?.message} />
            </div>
            <div className="mt-3">
              <NutrientField label="Fibre (g, optional)" placeholder="5" {...form.register('fiber_g_per_100g', { valueAsNumber: true })} error={form.formState.errors.fiber_g_per_100g?.message} />
            </div>
          </div>

          {/* Per-serving preview */}
          {kcal > 0 && (
            <div className="rounded-card border border-hairline bg-energy-soft p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-energy-ink mb-2">Per serving ({serving}g)</p>
              <div className="flex gap-4">
                <MiniStat value={perServing.kcal} label="kcal" className="font-bold text-lg text-energy-ink" />
                <MiniStat value={perServing.protein} label="P" className="font-bold" style={{ color: 'var(--protein)' }} />
                <MiniStat value={perServing.carbs} label="C" className="font-bold" style={{ color: 'var(--carbs)' }} />
                <MiniStat value={perServing.fat} label="F" className="font-bold" style={{ color: 'var(--fat)' }} />
              </div>
            </div>
          )}

          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full tap-scale">
            {isSubmitting ? 'Creating...' : 'Create food & log it'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function NutrientField({
  label, placeholder, error, ...props
}: {
  label: string
  placeholder: string
  error?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs text-ink-2 mb-1">{label}</label>
      <Input type="number" step="0.1" min="0" placeholder={placeholder} {...props} />
      {error && <p className="mt-0.5 text-[10px] text-danger">{error}</p>}
    </div>
  )
}

function MiniStat({ value, label, className, style }: { value: number; label: string; className: string; style?: React.CSSProperties }) {
  return (
    <div className="text-center">
      <p className={className} style={style}>{value}</p>
      <p className="text-[10px] text-energy-ink">{label}</p>
    </div>
  )
}
