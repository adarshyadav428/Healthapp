'use client'

import { useState } from 'react'
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

export function ExerciseLogModal({ onClose }: { onClose: () => void }) {
  const { user } = useUser()
  const form = useForm<ExerciseLogData>({
    resolver: zodResolver(exerciseLogSchema),
    defaultValues: {
      activity: '',
      duration_min: 30,
      calories: 200,
    },
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()

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
      toast({ title: 'Exercise logged', description: 'Great work staying active.' })
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log exercise</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="activity">Activity</Label>
            <Input id="activity" placeholder="Walk, gym, yoga..." {...form.register('activity')} />
            {form.formState.errors.activity ? (
              <p className="mt-1 text-xs text-red-500">{form.formState.errors.activity.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="duration">Duration (min)</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                step="1"
                {...form.register('duration_min', { valueAsNumber: true })}
              />
              {form.formState.errors.duration_min ? (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.duration_min.message}</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="calories">Calories burned</Label>
              <Input
                id="calories"
                type="number"
                min="1"
                step="1"
                {...form.register('calories', { valueAsNumber: true })}
              />
              {form.formState.errors.calories ? (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.calories.message}</p>
              ) : null}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={form.handleSubmit(handleSubmit)} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Log Exercise'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
