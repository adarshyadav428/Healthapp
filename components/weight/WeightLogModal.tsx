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
import { weightLogSchema, type WeightLogData } from '../../lib/validations'

export function WeightLogModal({ onClose }: { onClose: () => void }) {
  const { user, profile } = useUser()
  const form = useForm<WeightLogData>({
    resolver: zodResolver(weightLogSchema),
    defaultValues: {
      weight_kg: profile?.current_weight_kg ?? 70,
      measured_at: new Date().toISOString(),
      notes: '',
    },
  })
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()

  const handleSubmit = async (values: WeightLogData) => {
    try {
      if (!user) throw new Error('You must be signed in.')
      setIsSubmitting(true)
      const supabase = getBrowserSupabaseClient()

      const measuredAt = new Date(`${date}T00:00:00.000Z`).toISOString()
      const weightKg =
        profile?.unit_system === 'imperial'
          ? Math.round(values.weight_kg * 0.453592 * 10) / 10
          : values.weight_kg

      const { error } = await supabase.from('weight_logs').insert({
        user_id: user.id,
        weight_kg: weightKg,
        measured_at: measuredAt,
        notes: values.notes,
      })

      if (error) throw new Error(error.message)
      toast({ title: 'Weight logged', description: 'Nice progress!' })
      queryClient.invalidateQueries({ queryKey: ['weight-logs'] })
      onClose()
    } catch (err) {
      toast({ title: 'Failed to log weight', description: (err as Error).message, variant: 'error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log weight</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <input type="hidden" {...form.register('measured_at')} />
          <div>
            <Label htmlFor="weight">Weight ({profile?.unit_system === 'imperial' ? 'lbs' : 'kg'})</Label>
            <Input id="weight" type="number" step="0.1" min="1" {...form.register('weight_kg', { valueAsNumber: true })} />
            {form.formState.errors.weight_kg ? (
              <p className="mt-1 text-xs text-red-500">{form.formState.errors.weight_kg.message}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
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
            {form.formState.errors.measured_at ? (
              <p className="mt-1 text-xs text-red-500">{form.formState.errors.measured_at.message}</p>
            ) : null}
          </div>
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" {...form.register('notes')} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={form.handleSubmit(handleSubmit)} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Log Weight'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
