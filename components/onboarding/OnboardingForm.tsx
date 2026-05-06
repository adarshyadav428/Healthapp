'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { onboardingSchema, type OnboardingData } from '../../lib/validations'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { toast } from '../ui/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { calculateTDEE } from '../../lib/tdee'

const TOTAL_STEPS = 5

const STEP_LABELS = ['About you', 'Body stats', 'Your weight', 'Your goal', 'Lifestyle']
const STEP_EMOJIS = ['👤', '📏', '⚖️', '🎯', '🏃']

export function OnboardingForm() {
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
      toast({ title: 'Profile saved!', description: 'Welcome to CalTrack 🎉' })
      window.location.href = '/dashboard'
    } catch (err) {
      toast({ title: 'Onboarding failed', description: (err as Error).message, variant: 'error' })
    }
  }

  const isMetric = form.watch('unit_system') === 'metric'
  const progress = (step / TOTAL_STEPS) * 100

  // Live TDEE preview for Step 5
  const watchedValues = form.watch()
  let tdeePreview: { daily_calorie_target: number; protein_g_target: number; carbs_g_target: number; fat_g_target: number } | null = null
  try {
    if (watchedValues.height_cm > 0 && watchedValues.current_weight_kg > 0 && watchedValues.age > 0) {
      tdeePreview = calculateTDEE({
        weightKg: isMetric ? watchedValues.current_weight_kg : watchedValues.current_weight_kg * 0.453592,
        heightCm: isMetric ? watchedValues.height_cm : watchedValues.height_cm * 2.54,
        age: watchedValues.age,
        sex: watchedValues.sex,
        activity_level: watchedValues.activity_level,
        goal: watchedValues.goal,
        paceKgPerWeek: watchedValues.pace_kg_per_week,
      })
    }
  } catch { /* ignore */ }

  return (
    <div>
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-lg">{STEP_EMOJIS[step - 1]}</span>
          <span className="text-xs font-semibold text-orange-600">{step} / {TOTAL_STEPS}</span>
        </div>
        <div className="h-1.5 rounded-full bg-orange-100 dark:bg-orange-950/30 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-semibold text-foreground">{STEP_LABELS[step - 1]}</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Step 1: Name + Units */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">What should we call you?</label>
              <input
                {...form.register('display_name')}
                className="w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-4 py-2.5 text-sm text-foreground outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 transition-all"
                placeholder="Your name"
              />
              {form.formState.errors.display_name && (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.display_name.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Preferred units</label>
              <div className="grid grid-cols-2 gap-2">
                {(['metric', 'imperial'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => form.setValue('unit_system', u)}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-all ${
                      form.watch('unit_system') === u
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300'
                        : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-foreground hover:border-orange-200 dark:hover:border-orange-800'
                    }`}
                  >
                    {u === 'metric' ? '📐 Metric (cm, kg)' : '📏 Imperial (in, lbs)'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Age + Sex */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Age</label>
              <input
                type="number"
                {...form.register('age', { valueAsNumber: true })}
                className="w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-4 py-2.5 text-sm text-foreground outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 transition-all"
                placeholder="25"
              />
              {form.formState.errors.age && (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.age.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Biological sex</label>
              <div className="grid grid-cols-3 gap-2">
                {(['male', 'female', 'other'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => form.setValue('sex', s)}
                    className={`rounded-2xl border px-3 py-3 text-sm font-semibold capitalize transition-all ${
                      form.watch('sex') === s
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300'
                        : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-foreground hover:border-orange-200 dark:hover:border-orange-800'
                    }`}
                  >
                    {s === 'male' ? '♂️ Male' : s === 'female' ? '♀️ Female' : '⚧ Other'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Height + Current weight */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                Height ({isMetric ? 'cm' : 'inches'})
              </label>
              <input
                type="number"
                {...form.register('height_cm', { valueAsNumber: true })}
                className="w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-4 py-2.5 text-sm text-foreground outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 transition-all"
                placeholder={isMetric ? '170' : '67'}
              />
              {form.formState.errors.height_cm && (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.height_cm.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                Current weight ({isMetric ? 'kg' : 'lbs'})
              </label>
              <input
                type="number"
                {...form.register('current_weight_kg', { valueAsNumber: true })}
                className="w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-4 py-2.5 text-sm text-foreground outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 transition-all"
                placeholder={isMetric ? '70' : '154'}
              />
              {form.formState.errors.current_weight_kg && (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.current_weight_kg.message}</p>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Target weight + Goal */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">
                Target weight ({isMetric ? 'kg' : 'lbs'})
              </label>
              <input
                type="number"
                {...form.register('target_weight_kg', { valueAsNumber: true })}
                className="w-full rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-4 py-2.5 text-sm text-foreground outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 transition-all"
                placeholder={isMetric ? '65' : '143'}
              />
              {form.formState.errors.target_weight_kg && (
                <p className="mt-1 text-xs text-red-500">{form.formState.errors.target_weight_kg.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Goal</label>
              <div className="grid grid-cols-3 gap-2">
                {(['lose', 'maintain', 'gain'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => form.setValue('goal', g)}
                    className={`rounded-2xl border px-3 py-3 text-sm font-semibold capitalize transition-all ${
                      form.watch('goal') === g
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300'
                        : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-foreground hover:border-orange-200 dark:hover:border-orange-800'
                    }`}
                  >
                    {g === 'lose' ? '📉 Lose' : g === 'maintain' ? '⚖️ Maintain' : '📈 Gain'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Activity + Pace */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">Activity level</label>
              <div className="space-y-2">
                {([
                  { value: 'sedentary', label: 'Sedentary', desc: 'Desk job, little exercise', emoji: '🛋️' },
                  { value: 'light', label: 'Light', desc: '1–3 days/week exercise', emoji: '🚶' },
                  { value: 'moderate', label: 'Moderate', desc: '3–5 days/week exercise', emoji: '🏋️' },
                  { value: 'active', label: 'Active', desc: '6–7 days/week hard training', emoji: '🏃' },
                  { value: 'very_active', label: 'Very active', desc: 'Athlete / physical job', emoji: '⚡' },
                ] as const).map((a) => (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => form.setValue('activity_level', a.value)}
                    className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                      form.watch('activity_level') === a.value
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                        : 'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 hover:border-orange-200 dark:hover:border-orange-800'
                    }`}
                  >
                    <span className="text-lg">{a.emoji}</span>
                    <div>
                      <p className={`text-sm font-semibold ${form.watch('activity_level') === a.value ? 'text-orange-700 dark:text-orange-300' : 'text-foreground'}`}>{a.label}</p>
                      <p className="text-xs text-muted">{a.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">Goal pace (kg/week)</label>
              <Select
                value={String(form.watch('pace_kg_per_week'))}
                onValueChange={(v) => form.setValue('pace_kg_per_week', Number(v))}
              >
                <SelectTrigger className="rounded-2xl border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.25">0.25 kg/week — Slow & steady</SelectItem>
                  <SelectItem value="0.5">0.5 kg/week — Recommended</SelectItem>
                  <SelectItem value="0.75">0.75 kg/week — Aggressive</SelectItem>
                  <SelectItem value="1">1.0 kg/week — Maximum</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Live TDEE preview on final step */}
        {step === 5 && tdeePreview && (
          <div className="rounded-2xl border border-orange-100 dark:border-orange-900/30 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400 mb-2">Your personalised targets</p>
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="text-3xl font-black text-orange-700 dark:text-orange-400">{tdeePreview.daily_calorie_target.toLocaleString()}</span>
              <span className="text-sm text-orange-500 dark:text-orange-400 font-semibold">kcal / day</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-blue-100 dark:bg-blue-950/40 py-2 text-center">
                <p className="text-sm font-black text-blue-800 dark:text-blue-300">{tdeePreview.protein_g_target}g</p>
                <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">Protein</p>
              </div>
              <div className="rounded-xl bg-amber-100 dark:bg-amber-950/40 py-2 text-center">
                <p className="text-sm font-black text-amber-800 dark:text-amber-300">{tdeePreview.carbs_g_target}g</p>
                <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">Carbs</p>
              </div>
              <div className="rounded-xl bg-rose-100 dark:bg-rose-950/40 py-2 text-center">
                <p className="text-sm font-black text-rose-800 dark:text-rose-300">{tdeePreview.fat_g_target}g</p>
                <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">Fat</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-orange-500 dark:text-orange-400">Calculated using Mifflin-St Jeor formula. You can adjust this anytime in settings.</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={prevStep}
            disabled={step === 1}
            className="flex items-center gap-1 rounded-2xl px-4 py-2.5 text-sm font-semibold text-muted hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-0 transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={isNavigating}
              className="flex items-center gap-1 rounded-2xl bg-orange-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-orange-700 active:scale-[.98] transition-all shadow-sm disabled:opacity-60"
            >
              {isNavigating ? 'Checking...' : 'Next'}
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="rounded-2xl bg-orange-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-orange-700 active:scale-[.98] transition-all shadow-sm disabled:opacity-60"
            >
              {form.formState.isSubmitting ? 'Saving...' : '🎉 Finish setup'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
