'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { getBrowserSupabaseClient } from '../../lib/supabase/client'
import { toast } from '../ui/use-toast'
import { useUser } from '../../hooks/useUser'
import { useQueryClient } from '@tanstack/react-query'
import { weightLogSchema, type WeightLogData } from '../../lib/validations'
import { Scale, X } from 'lucide-react'

const QUICK_ADJUSTMENTS = [-1, -0.5, +0.5, +1]

export function WeightLogModal({ onClose }: { onClose: () => void }) {
  const { user, profile } = useUser()
  const isImperial = profile?.unit_system === 'imperial'
  const unit = isImperial ? 'lbs' : 'kg'
  const defaultWeight = profile?.current_weight_kg
    ? isImperial
      ? Math.round(profile.current_weight_kg * 2.20462 * 10) / 10
      : profile.current_weight_kg
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
      const supabase = getBrowserSupabaseClient()

      const measuredAt = new Date(`${date}T00:00:00.000Z`).toISOString()
      const weightKg = isImperial
        ? Math.round(values.weight_kg * 0.453592 * 10) / 10
        : values.weight_kg

      const { error } = await supabase.from('weight_logs').insert({
        user_id: user.id,
        weight_kg: weightKg,
        measured_at: measuredAt,
        notes: values.notes,
      })

      if (error) throw new Error(error.message)
      toast({ title: '⚖️ Weight logged!', description: 'Keep it up.', duration: 2500 })
      queryClient.invalidateQueries({ queryKey: ['weight-logs'] })
      onClose()
    } catch (err) {
      toast({ title: 'Failed to log weight', description: (err as Error).message, variant: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl">
        {/* Handle */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 h-1 w-10 rounded-full bg-gray-200" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6 mt-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100">
              <Scale className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">Log weight</h2>
              <p className="text-xs text-gray-400">Track your progress</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Weight input - big hero number */}
          <div className="text-center">
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Weight ({unit})
            </label>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => form.setValue('weight_kg', Math.max(1, weight - 0.1), { shouldValidate: true })}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-600 hover:bg-gray-200 active:scale-90 transition-all"
              >
                −
              </button>
              <input
                type="number"
                step="0.1"
                min="1"
                {...form.register('weight_kg', { valueAsNumber: true })}
                className="w-28 text-center text-4xl font-black text-gray-900 outline-none border-b-2 border-emerald-400 bg-transparent pb-1 focus:border-emerald-600"
              />
              <button
                type="button"
                onClick={() => form.setValue('weight_kg', weight + 0.1, { shouldValidate: true })}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg font-bold text-gray-600 hover:bg-gray-200 active:scale-90 transition-all"
              >
                +
              </button>
            </div>
            {form.formState.errors.weight_kg && (
              <p className="mt-1 text-xs text-red-500">{form.formState.errors.weight_kg.message}</p>
            )}

            {/* Quick adjustments */}
            <div className="flex justify-center gap-2 mt-3">
              {QUICK_ADJUSTMENTS.map((adj) => (
                <button
                  key={adj}
                  type="button"
                  onClick={() => form.setValue('weight_kg', Math.max(1, +(weight + adj).toFixed(1)), { shouldValidate: true })}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95 transition-all"
                >
                  {adj > 0 ? `+${adj}` : adj}
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                const value = e.target.value
                setDate(value)
                form.setValue('measured_at', new Date(`${value}T00:00:00.000Z`).toISOString(), {
                  shouldValidate: true,
                })
              }}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Notes (optional)</label>
            <input
              {...form.register('notes')}
              placeholder="e.g. Morning, after workout..."
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 active:scale-[.98] transition-all shadow-sm disabled:opacity-60"
          >
            {isSubmitting ? 'Saving...' : 'Save weight'}
          </button>
        </form>
      </div>
    </div>
  )
}
