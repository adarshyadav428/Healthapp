'use client'

import { useRef, useState, type FormEvent } from 'react'
import dynamic from 'next/dynamic'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { onboardingSchema, type OnboardingData } from '../../lib/validations'
import { toast } from '../ui/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, ChevronLeft, Camera, MessageSquarePlus } from 'lucide-react'
import { calculateTDEE, PROTEIN_G_PER_KG } from '../../lib/tdee'
import { computeBmi, bmiCategory, healthyWeightRange, suggestedTargets } from '../../lib/bmi'
import {
  BODY_TYPES, BODY_TYPE_META, BODY_FOCUSES, BODY_FOCUS_META,
  planForFocus, focusFromBodyType, type BodyFocus, type BodyType,
} from '../../lib/bodyType'
import { BodyTypeImage } from './BodyTypeImage'
import { projectGoalDate, formatGoalDate } from '../../lib/projection'
import { ftInToCm } from '../../lib/units'
import { useOnboardingDraft, TOTAL_STEPS, STEP_LABELS } from '../../hooks/useOnboardingDraft'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { ConfettiBurst } from '../ui/ConfettiBurst'
import type { Food } from '../../types/index'

const CameraModal  = dynamic(() => import('../camera/CameraModal').then(m => m.CameraModal), { ssr: false })
const ChatLogModal = dynamic(() => import('../chat/ChatLogModal').then(m => m.ChatLogModal),  { ssr: false })
const AddFoodModal = dynamic(() => import('../log/AddFoodModal').then(m => m.AddFoodModal),   { ssr: false })

const STEP_EMOJIS = ['📸', '👤', '📏', '⚖️', '🎯', '🏃']

const selectClass =
  'w-full rounded-control border border-hairline bg-surface-2 px-4 py-2.5 text-sm font-semibold text-ink outline-none transition-all focus:border-brand focus:ring-[3px] focus:ring-brand-ring'

const pillBase =
  'rounded-control border px-3 py-3 text-sm font-semibold capitalize transition-all'
const pillOn = 'border-brand bg-brand-soft text-brand-ink'
const pillOff = 'border-hairline bg-surface-2 text-ink hover:border-brand-ring'

export function OnboardingForm() {
  const queryClient = useQueryClient()
  const [celebrating, setCelebrating] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [barcodeFood, setBarcodeFood] = useState<Food | null>(null)
  // CameraModal fires both onFoodFound and onClose for a barcode hit — this
  // suppresses the step-advance from onClose so AddFoodModal's own onClose
  // is the one that advances (avoids double-advancing past a step unseen).
  const barcodeHandoffRef = useRef(false)

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
      body_focus: 'fat_loss',
      activity_level: 'moderate',
      pace_kg_per_week: 0.5,
    },
  })

  // Set once the user picks a focus tile by hand. After that a body-type tap
  // still records the type but stops rewriting goal/pace — body type is a
  // shortcut into the focus, never an override of a deliberate choice.
  const focusTouchedRef = useRef(false)

  // The one place goal and pace are written from a focus. `goal` is derived so
  // the three-value column and everything branching on it stay untouched; the
  // pace is only pinned for the two muscle focuses (see lib/bodyType.ts).
  const applyFocus = (f: BodyFocus, opts?: { byHand?: boolean }) => {
    const { goal, pace } = planForFocus(f)
    form.setValue('body_focus', f, { shouldValidate: true })
    form.setValue('goal', goal)
    if (pace !== null) form.setValue('pace_kg_per_week', pace)
    if (opts?.byHand) focusTouchedRef.current = true
  }

  const pickBodyType = (t: BodyType) => {
    form.setValue('body_type', t)
    if (!focusTouchedRef.current) applyFocus(focusFromBodyType(t))
  }

  const {
    step, isNavigating, heightFt, setHeightFt, heightIn, setHeightIn,
    nextStep, prevStep, clearDraft,
  } = useOnboardingDraft(form)

  // Every field has a valid default and onboardingSchema has no cross-field
  // rule, so the form is valid the moment a name is typed. Left alone, pressing
  // Enter in any input on steps 2–4 implicitly submits the whole form — saving
  // defaults for every unreached field and skipping straight to the plan
  // screen. On those steps Enter instead advances one step (through nextStep's
  // per-step validation); only the final step's submit actually submits.
  const handleFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (step < TOTAL_STEPS) {
      e.preventDefault()
      nextStep()
      return
    }
    form.handleSubmit(onSubmit)(e)
  }

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

      clearDraft()
      queryClient.invalidateQueries({ queryKey: ['profile'] })
      // The overlay is a transition cover, not the celebration — that's now
      // /onboarding/plan, which hands over the calorie target, protein target
      // and projected goal date rather than congratulating someone for filling
      // in a form. Short, because the payoff is on the next screen.
      setCelebrating(true)
      setTimeout(() => {
        window.location.href = '/onboarding/plan'
      }, 900)
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

  // "You'll reach X kg by ~date" — the projected-date wow moment (step 6).
  const goalProjection =
    watchedValues.goal !== 'maintain' &&
    watchedValues.current_weight_kg > 0 &&
    watchedValues.target_weight_kg > 0
      ? projectGoalDate(watchedValues.current_weight_kg, watchedValues.target_weight_kg, watchedValues.pace_kg_per_week)
      : null

  return (
    <div>
      {celebrating && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-canvas px-8" role="status">
          <ConfettiBurst />
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-3xl">
              🎉
            </div>
            <h2 className="mt-5 font-display text-[26px] font-bold text-ink">Building your plan…</h2>
            <p className="mt-2 text-sm text-ink-2">Working out your targets.</p>
          </div>
        </div>
      )}

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

      <form onSubmit={handleFormSubmit} className="space-y-4">
        {/* Step 1: Log a meal — the activation moment, before any biometrics */}
        {step === 1 && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft">
              <span className="text-3xl">📸</span>
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">What did you eat recently?</h2>
              <p className="mt-1 text-sm text-ink-2">See how fast this is — then we&apos;ll set up your goals in under a minute.</p>
            </div>
            <div className="space-y-2.5 pt-2 text-left">
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="flex w-full items-center gap-3 rounded-card border border-hairline bg-surface px-4 py-3.5 text-left tap-scale transition-colors hover:border-brand-ring"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-control bg-brand-soft">
                  <Camera className="h-5 w-5 text-brand" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">Take a photo</p>
                  <p className="text-xs text-ink-2">Snap your plate — AI reads the macros</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setShowChat(true)}
                className="flex w-full items-center gap-3 rounded-card border border-hairline bg-surface px-4 py-3.5 text-left tap-scale transition-colors hover:border-brand-ring"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-control bg-brand-soft">
                  <MessageSquarePlus className="h-5 w-5 text-brand" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">Describe it</p>
                  <p className="text-xs text-ink-2">&quot;2 roti, dal, sabzi&quot; — type it in</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Name */}
        {step === 2 && (
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

        {/* Step 2 (cont.): Age + Sex */}
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
            {/* Which build you're starting from. Optional — it exists to
                preselect the goal below, which the user watches happen. */}
            <div>
              <label className="block text-sm font-semibold text-ink mb-1.5">Which is closest to you?</label>
              {/* Three-across, not five: the illustrations need the width to
                  stay legible on a phone, and five 65px tiles did not give it
                  to them. Five items over two rows leaves one gap on the
                  second row, which is fine — a stretched last tile would read
                  as a different kind of control. */}
              <div className="grid grid-cols-3 gap-2">
                {BODY_TYPES.map((t) => {
                  const on = form.watch('body_type') === t
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => pickBodyType(t)}
                      className={`flex flex-col items-center gap-1.5 rounded-control border px-1 py-2.5 transition-all tap-scale ${on ? pillOn : pillOff}`}
                    >
                      <BodyTypeImage type={t} sex={form.watch('sex')} selected={on} className="h-24 w-full" />
                      <span className={`text-[11px] font-semibold leading-tight text-center ${on ? 'text-brand-ink' : 'text-ink-2'}`}>
                        {BODY_TYPE_META[t].label}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="mt-1.5 text-[11px] text-ink-3">
                Just to set your starting point — you can change anything below.
              </p>
            </div>
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

        {/* Step 3 (cont.): Target weight + Goal */}
        {step === 3 && (
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
                const currentBmi = +computeBmi(wKg, hCm).toFixed(1)
                const cat = bmiCategory(currentBmi)
                const bmiLabel = cat === 'underweight' ? 'Underweight' : cat === 'healthy' ? 'Healthy weight' : cat === 'overweight' ? 'Overweight' : 'Obese'
                const bmiColor = cat === 'underweight' ? 'text-protein' : cat === 'healthy' ? 'text-good' : cat === 'overweight' ? 'text-energy-ink' : 'text-danger'
                const suggestions = suggestedTargets(hCm).map((s) => ({ bmi: s.bmi, kg: +s.kg.toFixed(1) }))
                const range = healthyWeightRange(hCm)
                const minHealthy = +range.minKg.toFixed(1)
                const maxHealthy = +range.maxKg.toFixed(1)
                return (
                  <div className="mt-2 rounded-card border border-hairline bg-brand-soft p-3 space-y-2">
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
              {/* Deliberately not `pillBase` below: it carries `capitalize`,
                  which would render "Build Muscle & Lose Fat". */}
              <div className="grid grid-cols-2 gap-2">
                {BODY_FOCUSES.map((f) => {
                  const on = form.watch('body_focus') === f
                  const meta = BODY_FOCUS_META[f]
                  return (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={on}
                      onClick={() => applyFocus(f, { byHand: true })}
                      className={`flex flex-col items-start gap-0.5 rounded-control border px-3 py-3 text-left transition-all ${on ? pillOn : pillOff}`}
                    >
                      <span className="text-sm font-semibold leading-tight">{meta.emoji} {meta.label}</span>
                      <span className={`text-[11px] font-normal leading-tight ${on ? 'text-brand-ink' : 'text-ink-2'}`}>
                        {meta.desc}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Activity + Pace */}
        {step === 4 && (
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
              {/* Preselected to 0.25 by the focus, not locked to it — a fast
                  pace and "build muscle" pull against each other, and saying so
                  is more use than taking the control away. */}
              {(form.watch('body_focus') === 'recomp' || form.watch('body_focus') === 'muscle_gain') && (
                <p className="mt-1.5 text-[11px] text-ink-2">
                  A gentle pace is what keeps muscle while fat comes off — we&apos;ve set 0.25 for you.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Live TDEE preview — the payoff moment, marigold because it's your data */}
        {step === 4 && tdeePreview && (
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
            {goalProjection && (
              <div className="mt-3 rounded-control bg-surface p-3 text-center">
                <p className="text-[13px] font-bold text-brand-ink">
                  🎯 At this pace, you&apos;ll reach {watchedValues.target_weight_kg} kg by ~{formatGoalDate(goalProjection.date)}
                </p>
              </div>
            )}
            <p className="mt-2 text-[11px] text-energy-ink">
              Mifflin-St Jeor formula, protein at {PROTEIN_G_PER_KG} g per kg of bodyweight.
              You can adjust this anytime in settings.
            </p>
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
          {step === 1 ? (
            <button
              type="button"
              onClick={() => nextStep({ skipped: true })}
              disabled={isNavigating}
              className="rounded-control px-4 py-2.5 text-sm font-semibold text-ink-2 hover:bg-surface-2 transition-all disabled:opacity-50"
            >
              Skip for now
            </button>
          ) : step < TOTAL_STEPS ? (
            <Button type="button" onClick={() => nextStep()} disabled={isNavigating} className="gap-1 tap-scale">
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

      {showCamera && (
        <CameraModal
          context="onboarding"
          onClose={() => {
            setShowCamera(false)
            if (barcodeHandoffRef.current) { barcodeHandoffRef.current = false; return }
            nextStep()
          }}
          onFoodFound={(food) => { barcodeHandoffRef.current = true; setBarcodeFood(food) }}
        />
      )}
      {showChat && <ChatLogModal context="onboarding" onClose={() => { setShowChat(false); nextStep() }} />}
      {barcodeFood && (
        <AddFoodModal food={barcodeFood} onClose={() => { setBarcodeFood(null); nextStep() }} />
      )}
    </div>
  )
}
