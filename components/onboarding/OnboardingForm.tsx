'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { onboardingSchema, type OnboardingData } from '../../lib/validations'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Progress } from '../ui/progress'
import { toast } from '../ui/use-toast'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

const TOTAL_STEPS = 5

export function OnboardingForm() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)
  const [isNavigating, setIsNavigating] = useState(false)

  const form = useForm<OnboardingData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      display_name: '',
      unit_system: 'metric',
      age: 25,
      sex: 'female',
      height_cm: 170,
      current_weight_kg: 70,
      target_weight_kg: 65,
      goal: 'lose',
      activity_level: 'moderate',
      pace_kg_per_week: 0.5,
    },
  })

  const nextStep = async () => {
    if (isNavigating) return
    const fieldsByStep: Record<number, (keyof OnboardingData)[]> = {
      1: ['display_name', 'unit_system'],
      2: ['age', 'sex'],
      3: ['height_cm', 'current_weight_kg'],
      4: ['target_weight_kg', 'goal'],
      5: ['activity_level', 'pace_kg_per_week'],
    }
    setIsNavigating(true)
    try {
      const ok = await form.trigger(fieldsByStep[step])
      if (ok) setStep((s) => Math.min(TOTAL_STEPS, s + 1))
    } finally {
      setIsNavigating(false)
    }
  }

  const prevStep = () => setStep((s) => Math.max(1, s - 1))

  const onSubmit = async (values: OnboardingData) => {
    try {
      const payload: OnboardingData = { ...values }

      if (values.unit_system === 'imperial') {
        payload.height_cm = Math.round(values.height_cm * 2.54)
        payload.current_weight_kg = Math.round(values.current_weight_kg * 0.453592 * 10) / 10
        payload.target_weight_kg = Math.round(values.target_weight_kg * 0.453592 * 10) / 10
      }

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Failed to save onboarding data')
      }

      queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast({ title: 'Profile saved', description: 'Welcome to CalTrack!' })
      router.push('/dashboard')
    } catch (err) {
      toast({ title: 'Onboarding failed', description: (err as Error).message, variant: 'error' })
    }
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-gray-500">Step {step} of {TOTAL_STEPS}</p>
        <Progress value={(step / TOTAL_STEPS) * 100} className="mt-2" />
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="display_name">Display name</Label>
              <Input id="display_name" {...form.register('display_name')} />
              {form.formState.errors.display_name ? (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.display_name.message}</p>
              ) : null}
            </div>
            <div>
              <Label>Units</Label>
              <Select value={form.watch('unit_system')} onValueChange={(value) => form.setValue('unit_system', value as OnboardingData['unit_system'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit system" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="metric">Metric (cm, kg)</SelectItem>
                  <SelectItem value="imperial">Imperial (in, lbs)</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.unit_system ? (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.unit_system.message}</p>
              ) : null}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="age">Age</Label>
              <Input id="age" type="number" {...form.register('age', { valueAsNumber: true })} />
              {form.formState.errors.age ? (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.age.message}</p>
              ) : null}
            </div>
            <div>
              <Label>Sex</Label>
              <Select value={form.watch('sex')} onValueChange={(value) => form.setValue('sex', value as OnboardingData['sex'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.sex ? (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.sex.message}</p>
              ) : null}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="height_cm">Height ({form.watch('unit_system') === 'metric' ? 'cm' : 'in'})</Label>
              <Input id="height_cm" type="number" {...form.register('height_cm', { valueAsNumber: true })} />
              {form.formState.errors.height_cm ? (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.height_cm.message}</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="current_weight_kg">Current weight ({form.watch('unit_system') === 'metric' ? 'kg' : 'lbs'})</Label>
              <Input id="current_weight_kg" type="number" {...form.register('current_weight_kg', { valueAsNumber: true })} />
              {form.formState.errors.current_weight_kg ? (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.current_weight_kg.message}</p>
              ) : null}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="target_weight_kg">Target weight ({form.watch('unit_system') === 'metric' ? 'kg' : 'lbs'})</Label>
              <Input id="target_weight_kg" type="number" {...form.register('target_weight_kg', { valueAsNumber: true })} />
              {form.formState.errors.target_weight_kg ? (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.target_weight_kg.message}</p>
              ) : null}
            </div>
            <div>
              <Label>Goal</Label>
              <Select value={form.watch('goal')} onValueChange={(value) => form.setValue('goal', value as OnboardingData['goal'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lose">Lose</SelectItem>
                  <SelectItem value="maintain">Maintain</SelectItem>
                  <SelectItem value="gain">Gain</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.goal ? (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.goal.message}</p>
              ) : null}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <div>
              <Label>Activity level</Label>
              <Select value={form.watch('activity_level')} onValueChange={(value) => form.setValue('activity_level', value as OnboardingData['activity_level'])}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentary">Sedentary</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="very_active">Very active</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.activity_level ? (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.activity_level.message}</p>
              ) : null}
            </div>
            <div>
              <Label>Goal pace (kg/week)</Label>
              <Select value={String(form.watch('pace_kg_per_week'))} onValueChange={(value) => form.setValue('pace_kg_per_week', Number(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.25">0.25</SelectItem>
                  <SelectItem value="0.5">0.5</SelectItem>
                  <SelectItem value="0.75">0.75</SelectItem>
                  <SelectItem value="1">1.0</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.pace_kg_per_week ? (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.pace_kg_per_week.message}</p>
              ) : null}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-4">
          <Button type="button" variant="ghost" onClick={prevStep} disabled={step === 1}>
            Back
          </Button>
          {step < TOTAL_STEPS ? (
            <Button type="button" onClick={nextStep} disabled={isNavigating || form.formState.isSubmitting}>
              {isNavigating ? 'Checking...' : 'Next'}
            </Button>
          ) : (
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? 'Saving...' : 'Finish'}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
