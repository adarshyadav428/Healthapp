'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { getBrowserSupabaseClient } from '../../lib/supabase/client'
import { toast } from '../ui/use-toast'
import { useUser } from '../../hooks/useUser'
import { useQueryClient } from '@tanstack/react-query'
import { exerciseLogSchema, type ExerciseLogData } from '../../lib/validations'
import { X, Flame } from 'lucide-react'

// MET values (metabolic equivalent)
const ACTIVITIES = [
  { label: 'Walking', emoji: '🚶', met: 3.5 },
  { label: 'Running', emoji: '🏃', met: 9.8 },
  { label: 'Cycling', emoji: '🚴', met: 7.5 },
  { label: 'Swimming', emoji: '🏊', met: 8.0 },
  { label: 'Yoga', emoji: '🧘', met: 3.0 },
  { label: 'Gym / Weight', emoji: '🏋️', met: 5.0 },
  { label: 'Cricket', emoji: '🏏', met: 5.0 },
  { label: 'Football', emoji: '⚽', met: 8.0 },
  { label: 'Dance', emoji: '💃', met: 5.5 },
  { label: 'HIIT', emoji: '🔥', met: 12.0 },
  { label: 'Badminton', emoji: '🏸', met: 7.0 },
  { label: 'Stairs', emoji: '🪜', met: 9.0 },
] as const

function estimateCalories(activityLabel: string, durationMin: number, weightKg = 70): number {
  const activity = ACTIVITIES.find((a) => a.label === activityLabel)
  if (!activity) return Math.round((durationMin / 60) * weightKg * 5)
  return Math.round((activity.met * weightKg * durationMin) / 60)
}

const DURATION_PRESETS = [15, 20, 30, 45, 60]

export function ExerciseLogModal({ onClose, bodyWeightKg }: { onClose: () => void; bodyWeightKg?: number }) {
  const { user } = useUser()
  const form = useForm<ExerciseLogData>({
    resolver: zodResolver(exerciseLogSchema),
    defaultValues: { activity: '', duration_min: 30, calories: 200 },
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const duration = form.watch('duration_min')
  const calories = form.watch('calories')

  useEffect(() => {
    if (selectedActivity && duration > 0) {
      const est = estimateCalories(selectedActivity, duration, bodyWeightKg)
      form.setValue('calories', est, { shouldValidate: false })
    }
  }, [selectedActivity, duration, bodyWeightKg, form])

  const pickActivity = (label: string) => {
    setSelectedActivity(label)
    form.setValue('activity', label)
    const est = estimateCalories(label, form.getValues('duration_min') || 30, bodyWeightKg)
    form.setValue('calories', est)
  }

  const handleSubmit = async (values: ExerciseLogData) => {
    try {
      if (!user) throw new Error('You must be signed in.')
      setIsSubmitting(true)
      const supabase = getBrowserSupabaseClient()

      const { error } = await supabase.from('exercise_logs').insert({
        user_id: user.id,
        activity: values.activity.trim(),
        duration_min: values.duration_min,
        calories: values.calories,
        logged_at: new Date().toISOString(),
      })

      if (error) throw new Error(error.message)
      toast({ title: '💪 Exercise logged!', description: `${Math.round(values.calories)} kcal burned.`, duration: 2500 })
      queryClient.invalidateQueries({ queryKey: ['exercise-logs'] })
      onClose()
    } catch (err) {
      toast({ title: 'Failed to log exercise', description: (err as Error).message, variant: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 h-1 w-10 rounded-full bg-gray-200" />

        {/* Header */}
        <div className="flex items-center justify-between mb-4 mt-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100">
              <Flame className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">Log exercise</h2>
              <p className="text-xs text-gray-400">Track your burn</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Activity grid */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Activity</p>
            <div className="grid grid-cols-3 gap-2">
              {ACTIVITIES.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => pickActivity(a.label)}
                  className={`flex flex-col items-center gap-1 rounded-2xl border py-2.5 px-1 text-xs font-semibold transition-all active:scale-95 ${
                    selectedActivity === a.label
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm'
                      : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-emerald-200 hover:bg-emerald-50'
                  }`}
                >
                  <span className="text-lg">{a.emoji}</span>
                  <span className="leading-tight text-center">{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom activity */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
              Or type activity name
            </label>
            <input
              placeholder="e.g. Kabaddi, Zumba, Hockey..."
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
              {...form.register('activity')}
              onChange={(e) => {
                form.setValue('activity', e.target.value)
                if (e.target.value) setSelectedActivity(null)
              }}
            />
            {form.formState.errors.activity && (
              <p className="mt-1 text-xs text-red-500">{form.formState.errors.activity.message}</p>
            )}
          </div>

          {/* Duration */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Duration (minutes)
            </label>
            <div className="flex gap-2 mb-2">
              {DURATION_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => form.setValue('duration_min', d, { shouldValidate: true })}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                    duration === d
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-emerald-200'
                  }`}
                >
                  {d}m
                </button>
              ))}
            </div>
            <input
              type="number"
              min="1"
              step="5"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-all"
              {...form.register('duration_min', { valueAsNumber: true })}
            />
          </div>

          {/* Calories burned preview */}
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-0.5">Calories burned</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-emerald-700">{Math.round(calories)}</span>
                  <span className="text-sm text-emerald-400">kcal</span>
                </div>
                {selectedActivity && (
                  <p className="text-[11px] text-emerald-500 mt-0.5">
                    Auto-estimated · adjust below if needed
                  </p>
                )}
              </div>
              <div className="text-3xl">🔥</div>
            </div>
            <div className="mt-2">
              <label className="block text-[11px] text-emerald-600 mb-1">Adjust calories:</label>
              <input
                type="number"
                min="1"
                className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-sm font-bold text-emerald-800 outline-none focus:border-emerald-400"
                {...form.register('calories', { valueAsNumber: true })}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={form.handleSubmit(handleSubmit)}
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-emerald-600 py-3.5 text-sm font-bold text-white hover:bg-emerald-700 active:scale-[.98] transition-all shadow-sm disabled:opacity-60"
          >
            {isSubmitting ? 'Saving...' : 'Log exercise'}
          </button>
        </div>
      </div>
    </div>
  )
}
