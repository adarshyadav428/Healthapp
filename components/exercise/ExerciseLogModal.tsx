'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { getBrowserSupabaseClient } from '../../lib/supabase/client'
import { toast } from '../ui/use-toast'
import { useUser } from '../../hooks/useUser'
import { useQueryClient } from '@tanstack/react-query'
import { exerciseLogSchema, type ExerciseLogData } from '../../lib/validations'

// MET values (metabolic equivalent) — kcal/kg/hour = MET
// We default to 70kg for estimation since we don't have weight in client scope
const ACTIVITIES: { label: string; emoji: string; met: number }[] = [
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
]

function estimateCalories(activityLabel: string, durationMin: number, weightKg = 70): number {
  const activity = ACTIVITIES.find((a) => a.label === activityLabel)
  if (!activity) return Math.round((durationMin / 60) * weightKg * 5) // fallback: moderate activity
  return Math.round((activity.met * weightKg * durationMin) / 60)
}

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

  // Auto-update calories when activity or duration changes
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
      toast({ title: 'Exercise logged 💪', description: `${Math.round(values.calories)} kcal burned!` })
      queryClient.invalidateQueries({ queryKey: ['exercise-logs'] })
      onClose()
    } catch (err) {
      toast({ title: 'Failed to log exercise', description: (err as Error).message, variant: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log exercise</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Quick-pick grid */}
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pick activity</Label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {ACTIVITIES.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  onClick={() => pickActivity(a.label)}
                  className={`flex flex-col items-center gap-1 rounded-2xl border py-2 px-1 text-xs font-semibold transition-all active:scale-95 ${
                    selectedActivity === a.label
                      ? 'border-orange-300 bg-orange-50 text-orange-700'
                      : 'border-gray-100 bg-gray-50 text-gray-600 hover:border-orange-200 hover:bg-orange-50'
                  }`}
                >
                  <span className="text-lg">{a.emoji}</span>
                  <span className="leading-tight text-center">{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Or type custom */}
          <div>
            <Label htmlFor="activity" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Or type custom
            </Label>
            <Input
              id="activity"
              placeholder="e.g. Kabaddi, Zumba..."
              className="mt-1"
              {...form.register('activity')}
              onChange={(e) => {
                form.setValue('activity', e.target.value)
                setSelectedActivity(null)
              }}
            />
            {form.formState.errors.activity && (
              <p className="mt-1 text-xs text-red-500">{form.formState.errors.activity.message}</p>
            )}
          </div>

          {/* Duration + calories */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="duration" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Duration (min)
              </Label>
              <Input
                id="duration"
                type="number"
                min="1"
                step="5"
                className="mt-1"
                {...form.register('duration_min', { valueAsNumber: true })}
              />
              {form.formState.errors.duration_min && (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.duration_min.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="calories" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Kcal burned
                {selectedActivity && <span className="ml-1 text-orange-500">(estimated)</span>}
              </Label>
              <Input
                id="calories"
                type="number"
                min="1"
                step="1"
                className="mt-1"
                {...form.register('calories', { valueAsNumber: true })}
              />
              {form.formState.errors.calories && (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.calories.message}</p>
              )}
            </div>
          </div>

          {/* Calorie estimate note */}
          {selectedActivity && (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
              Estimated for {form.watch('duration_min')} min of {selectedActivity} at {bodyWeightKg ?? 70} kg body weight.
              Adjust above if needed.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={form.handleSubmit(handleSubmit)}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Log Exercise'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
