'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { onboardingSchema, type OnboardingData } from '../../lib/validations'
import { toast } from '../ui/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { calculateTDEE } from '../../lib/tdee'
import { captureEvent } from '../../lib/posthog/client'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

const TOTAL_STEPS = 5

const STEP_LABELS = ['About you', 'Body stats', 'Your weight', 'Your goal', 'Lifestyle']
const STEP_EMOJIS = ['👤', '📏', '⚖️', '🎯', '🏃']

const selectClass =
  'w-full rounded-control border border-hairline bg-surface-2 px-4 py-2.5 text-sm font-semibold text-ink outline-none transition-all focus:border-brand focus:ring-[3px] focus:ring-brand-ring'

const pillBase =
  'rounded-control border px-3 py-3 text-sm font-semibold capitalize transition-all'
const pillOn = 'border-brand bg-brand-soft text-brand-ink'
const pillOff = 'border-hairline bg-surface-2 text-ink hover:border-brand/40'

// Convert feet + inches to cm
function ftInToCm(ft: number, inches: number): number {
  return Math.round((ft * 12 + inches) * 2.54)
}


export function OnboardingForm() {
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)
  const [isNavigating, setIsNavigating] = useState(false)
  const [heightFt, setHeightFt] = useState(5)
  const [heightIn, setHeightIn] = useState(7)

  const form = useForm<OnboardingData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      display_name: '',
      age: 25,
      sex: 'female',
      height_cm: ftInToCm(5, 7),
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
      1: ['display_name'],
      2: ['age', 'sex'],
      3: ['height_cm', 'current_weight_kg'],
      4: ['target_weight_kg', 'goal'],
      5: ['activity_level', 'pace_kg_per_week'],
    }
    setIsNavigating(true)
    try {
      const ok = await form.trigger(fieldsByStep[step])
      if (ok) {
        captureEvent('onboarding_step_completed', { step, label: STEP_LABELS[step - 1] })
        setStep((s) => Math.min(TOTAL_STEPS, s + 1))
      }
    } finally {
      setIsNavigating(false)
    }
  }

  const prevStep = () => setStep((s) => Math.max(1, s - 1))

  const onSubmit = async (values: OnboardingData) => {
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Failed to save onboarding data')
      }

      queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast({ title: 'Profile saved!', description: 'Welcome to GetInShape 🎉' })
      window.location.href = '/dashboard'
    } catch (err) {
      toast({ title: 'Onboarding failed', description: (err as Error).message, variant: 'error' })
    }
  }

  const progress = (step / TOTAL_STEPS) * 100

  // Live TDEE preview for Step 5
  const watchedValues = form.watch()
  let tdeePreview: { daily_calorie_target: number; protein_g_target: number; carbs_g_target: number; fat_g_target: number } | null = null
  try {
    if (watchedValues.height_cm > 0 && watchedValues.current_weight_kg > 0 && watchedValues.age > 0) {
      tdeePreview = calculateTDEE({
        weightKg: watchedValues.current_weight_kg,
        heightCm: watchedValues.height_cm,
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
          <span className="text-xs font-semibold text-brand-ink tabular-nums">{step} / {TOTAL_STEPS}</span>
        </div>
        <div className="h-1.5 rounded-full bg-brand-soft overflow-hidden">
          <div
            className="h-full rounded-full bg-brand transition-all duration-500 ease-spring"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-semibold text-ink">{STEP_LABELS[step - 1]}</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Step 1: Name */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-ink mb-1">What should we call you?</label>
              <Input {...form.register('display_name')} placeholder="Your name" />
              {form.formState.errors.display_name && (
                <p className="mt-1 text-xs text-danger">{form.formState.errors.display_name.message}</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Age + Sex */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-ink mb-1">Age</label>
              <Input type="number" {...form.register('age', { valueAsNumber: true })} placeholder="25" />
              {form.formState.errors.age && (
                <p className="mt-1 text-xs text-danger">{form.formState.errors.age.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-1">Biological sex</label>
              <div className="grid grid-cols-3 gap-2">
                {(['male', 'female', 'other'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => form.setValue('sex', s)}
                    className={`${pillBase} ${form.watch('sex') === s ? pillOn : pillOff}`}
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
              <label className="block text-sm font-semibold text-ink mb-1.5">Height</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <select
                    value={heightFt}
                    onChange={(e) => {
                      const ft = Number(e.target.value)
                      setHeightFt(ft)
                      form.setValue('height_cm', ftInToCm(ft, heightIn), { shouldValidate: true })
                    }}
                    className={selectClass}
                  >
                    {[3,4,5,6,7,8].map(ft => (
                      <option key={ft} value={ft}>{ft} ft</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <select
                    value={heightIn}
                    onChange={(e) => {
                      const inches = Number(e.target.value)
                      setHeightIn(inches)
                      form.setValue('height_cm', ftInToCm(heightFt, inches), { shouldValidate: true })
                    }}
                    className={selectClass}
                  >
                    {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => (
                      <option key={i} value={i}>{i} in</option>
                    ))}
                  </select>
                </div>
              </div>
              {form.formState.errors.height_cm && (
                <p className="mt-1 text-xs text-danger">{form.formState.errors.height_cm.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-1">Current weight (kg)</label>
              <Input type="number" {...form.register('current_weight_kg', { valueAsNumber: true })} placeholder="70" />
              {form.formState.errors.current_weight_kg && (
                <p className="mt-1 text-xs text-danger">{form.formState.errors.current_weight_kg.message}</p>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Target weight + Goal */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-ink mb-1">Target weight (kg)</label>
              <Input type="number" {...form.register('target_weight_kg', { valueAsNumber: true })} placeholder="65" />
              {form.formState.errors.target_weight_kg && (
                <p className="mt-1 text-xs text-danger">{form.formState.errors.target_weight_kg.message}</p>
              )}

              {/* BMI-based recommendation */}
              {(() => {
                const hCm = watchedValues.height_cm
                const wKg = watchedValues.current_weight_kg
                if (!hCm || !wKg || hCm <= 0 || wKg <= 0) return null
                const hM = hCm / 100
                const currentBmi = +(wKg / (hM * hM)).toFixed(1)
                const bmiLabel = currentBmi < 18.5 ? 'Underweight' : currentBmi < 25 ? 'Healthy weight' : currentBmi < 30 ? 'Overweight' : 'Obese'
                const bmiColor = currentBmi < 18.5 ? 'text-protein' : currentBmi < 25 ? 'text-good' : currentBmi < 30 ? 'text-energy-ink' : 'text-danger'
                const suggestions = [
                  { bmi: 20, kg: +(20 * hM * hM).toFixed(1) },
                  { bmi: 22, kg: +(22 * hM * hM).toFixed(1) },
                  { bmi: 24, kg: +(24 * hM * hM).toFixed(1) },
                ]
                const minHealthy = +(18.5 * hM * hM).toFixed(1)
                const maxHealthy = +(24.9 * hM * hM).toFixed(1)
                return (
                  <div className="mt-2 rounded-card border border-hairline bg-brand-soft/50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-ink-2">Your current BMI</span>
                      <span className={`text-xs font-bold ${bmiColor}`}>{currentBmi} · {bmiLabel}</span>
                    </div>
                    <p className="text-[11px] text-ink-2">
                      Healthy range for your height: <span className="font-semibold text-ink">{minHealthy}–{maxHealthy} kg</span> (BMI 18.5–24.9)
                    </p>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-2 mb-1.5">Suggested targets</p>
                      <div className="flex gap-2">
                        {suggestions.map((s) => (
                          <button
                            key={s.bmi}
                            type="button"
                            onClick={() => form.setValue('target_weight_kg', s.kg, { shouldValidate: true })}
                            className="flex-1 rounded-control border border-hairline bg-surface py-1.5 text-center hover:border-brand tap-scale transition-all"
                          >
                            <p className="text-xs font-bold text-brand-ink tabular-nums">{s.kg} kg</p>
                            <p className="text-[10px] text-ink-2">BMI {s.bmi}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-1">Goal</label>
              <div className="grid grid-cols-3 gap-2">
                {(['lose', 'maintain', 'gain'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => form.setValue('goal', g)}
                    className={`${pillBase} ${form.watch('goal') === g ? pillOn : pillOff}`}
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
              <label className="block text-sm font-semibold text-ink mb-2">Activity level</label>
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
                    className={`w-full flex items-center gap-3 rounded-control border px-4 py-3 text-left transition-all ${
                      form.watch('activity_level') === a.value ? pillOn : pillOff
                    }`}
                  >
                    <span className="text-lg">{a.emoji}</span>
                    <div>
                      <p className={`text-sm font-semibold ${form.watch('activity_level') === a.value ? 'text-brand-ink' : 'text-ink'}`}>{a.label}</p>
                      <p className="text-xs text-ink-2">{a.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-1">Goal pace (kg/week)</label>
              <select {...form.register('pace_kg_per_week', { valueAsNumber: true })} className={selectClass}>
                <option value="0.25">0.25 kg/week — Slow &amp; steady</option>
                <option value="0.5">0.5 kg/week — Recommended</option>
                <option value="0.75">0.75 kg/week — Aggressive</option>
                <option value="1">1.0 kg/week — Maximum</option>
              </select>
            </div>
          </div>
        )}

        {/* Live TDEE preview — the payoff moment, marigold because it's your data */}
        {step === 5 && tdeePreview && (
          <div className="rounded-card border border-hairline bg-energy-soft p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-energy-ink mb-2">Your personalised targets</p>
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="font-display text-3xl font-bold text-ink tabular-nums">{tdeePreview.daily_calorie_target.toLocaleString()}</span>
              <span className="text-sm text-energy-ink font-semibold">kcal / day</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-control bg-surface py-2 text-center">
                <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--protein)' }}>{tdeePreview.protein_g_target}g</p>
                <p className="text-[10px] font-semibold text-ink-2">Protein</p>
              </div>
              <div className="rounded-control bg-surface py-2 text-center">
                <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--carbs)' }}>{tdeePreview.carbs_g_target}g</p>
                <p className="text-[10px] font-semibold text-ink-2">Carbs</p>
              </div>
              <div className="rounded-control bg-surface py-2 text-center">
                <p className="text-sm font-bold tabular-nums" style={{ color: 'var(--fat)' }}>{tdeePreview.fat_g_target}g</p>
                <p className="text-[10px] font-semibold text-ink-2">Fat</p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-energy-ink">Calculated using Mifflin-St Jeor formula. You can adjust this anytime in settings.</p>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={prevStep}
            disabled={step === 1}
            className="flex items-center gap-1 rounded-control px-4 py-2.5 text-sm font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-0 transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          {step < TOTAL_STEPS ? (
            <Button type="button" onClick={nextStep} disabled={isNavigating} className="gap-1 tap-scale">
              {isNavigating ? 'Checking...' : 'Next'}
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={form.formState.isSubmitting} className="tap-scale">
              {form.formState.isSubmitting ? 'Saving...' : '🎉 Finish setup'}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
