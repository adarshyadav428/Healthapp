'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from '../ui/use-toast'
import { useUser } from '../../hooks/useUser'
import { useQueryClient } from '@tanstack/react-query'
import { weightLogSchema, type WeightLogData } from '../../lib/validations'
import type { WeightLog } from '../../types/index'
import { Sheet, SheetContent } from '../ui/sheet'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Scale, X } from 'lucide-react'
import { reportWeightMilestone } from '../../store/milestoneStore'

const QUICK_ADJUSTMENTS = [-1, -0.5, +0.5, +1]

export function WeightLogModal({ onClose, defaultWeightKg }: { onClose: () => void; defaultWeightKg?: number }) {
  const { user, profile } = useUser()
  const isImperial = profile?.unit_system === 'imperial'
  const unit = isImperial ? 'lbs' : 'kg'
  // Prefer an explicitly passed latest weight (WeightClient always has it), then
  // the profile weight; the 70 fallback only applies if truly nothing is known,
  // so a store-hydration gap can't silently seed a phantom -15 kg entry (P1-9a).
  const baseKg = defaultWeightKg ?? profile?.current_weight_kg
  const defaultWeight = baseKg
    ? isImperial
      ? Math.round(baseKg * 2.20462 * 10) / 10
      : baseKg
    : 70

  const form = useForm<WeightLogData>({
    resolver: zodResolver(weightLogSchema),
    defaultValues: {
      weight_kg: defaultWeight,
      measured_at: new Date().toISOString(),
      notes: '',
    },
  })
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()

  const weight = form.watch('weight_kg')

  const handleSubmit = async (values: WeightLogData) => {
    try {
      if (!user) throw new Error('You must be signed in.')
      setIsSubmitting(true)

      const measuredAt = new Date(`${date}T00:00:00.000Z`).toISOString()
      const weightKg = isImperial
        ? Math.round(values.weight_kg * 0.453592 * 10) / 10
        : values.weight_kg

      const res = await fetch('/api/weight/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight_kg: weightKg, measured_at: measuredAt, notes: values.notes ?? '' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to log weight')

      // Prepend the new row into the cache — no re-fetch needed
      if (data.row) {
        queryClient.setQueryData<WeightLog[]>(['weight-logs', user.id], (old = []) => [data.row, ...old])
      } else {
        queryClient.invalidateQueries({ queryKey: ['weight-logs'] })
      }

      if (data.milestone) {
        // Milestone celebration replaces the plain toast (overlay lives in providers)
        reportWeightMilestone(data.milestone)
      } else {
        toast({ title: '⚖️ Weight logged!', description: 'Keep it up.', duration: 2500 })
      }
      onClose()
    } catch (err) {
      toast({ title: 'Failed to log weight', description: (err as Error).message, variant: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent title="Log your weight">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-control" style={{ background: 'color-mix(in srgb, var(--good) 12%, transparent)' }}>
              <Scale className="h-5 w-5 text-good" />
            </div>
            <div>
              <h2 className="font-display text-body-lg font-bold text-ink">Log weight</h2>
              <p className="text-caption text-ink-2">Track your progress</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-surface-2 transition-colors">
            <X className="h-5 w-5 text-ink-2" />
          </button>
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Weight input - big hero number */}
          <div className="text-center">
            <label className="block text-caption font-semibold uppercase tracking-caps text-ink-2 mb-2">
              Weight ({unit})
            </label>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => form.setValue('weight_kg', Math.max(1, weight - 0.1), { shouldValidate: true })}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-title-sm font-bold text-ink hover:bg-hairline active:scale-90 transition-all"
              >
                −
              </button>
              <input
                type="number"
                step="0.1"
                min="1"
                {...form.register('weight_kg', { valueAsNumber: true })}
                className="w-28 text-center font-display text-display font-bold text-ink outline-none border-b-2 border-good bg-transparent pb-1 tabular-nums"
              />
              <button
                type="button"
                onClick={() => form.setValue('weight_kg', weight + 0.1, { shouldValidate: true })}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-title-sm font-bold text-ink hover:bg-hairline active:scale-90 transition-all"
              >
                +
              </button>
            </div>
            {form.formState.errors.weight_kg && (
              <p className="mt-1 text-caption text-danger">{form.formState.errors.weight_kg.message}</p>
            )}

            {/* Quick adjustments */}
            <div className="flex justify-center gap-2 mt-3">
              {QUICK_ADJUSTMENTS.map((adj) => (
                <button
                  key={adj}
                  type="button"
                  onClick={() => form.setValue('weight_kg', Math.max(1, +(weight + adj).toFixed(1)), { shouldValidate: true })}
                  className="rounded-control border border-hairline bg-surface-2 px-3 py-1 text-caption font-semibold text-ink hover:border-brand-ring hover:bg-brand-soft hover:text-brand-ink active:scale-95 transition-all"
                >
                  {adj > 0 ? `+${adj}` : adj}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-caption font-semibold uppercase tracking-caps text-ink-2 mb-1">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => {
                const value = e.target.value
                setDate(value)
                form.setValue('measured_at', new Date(`${value}T00:00:00.000Z`).toISOString(), {
                  shouldValidate: true,
                })
              }}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-caption font-semibold uppercase tracking-caps text-ink-2 mb-1">Notes (optional)</label>
            <Input {...form.register('notes')} placeholder="e.g. Morning, after workout..." />
          </div>

          <Button type="submit" size="lg" disabled={isSubmitting} className="w-full tap-scale">
            {isSubmitting ? 'Saving...' : 'Save weight'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
