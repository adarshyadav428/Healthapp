'use client'

import { useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { onboardingSchema, type OnboardingData } from '../../lib/validations'
import { toast } from '../ui/use-toast'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight, ChevronLeft, Camera, MessageSquarePlus } from 'lucide-react'
import { calculateTDEE, PROTEIN_G_PER_KG } from '../../lib/tdee'
import { computeBmi, bmiCategory, healthyWeightRange, suggestedTargets } from '../../lib/bmi'
import { projectGoalDate, formatGoalDate } from '../../lib/projection'
import { ftInToCm } from '../../lib/units'
import { useOnboardingDraft, TOTAL_STEPS, STEP_LABELS } from '../../hooks/useOnboardingDraft'
import {
  OBSTACLES,
  MAX_OBSTACLES,
  TRACKING_EXPERIENCES,
  type ObstacleId,
} from '../../lib/onboardingOptions'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { ConfettiBurst } from '../ui/ConfettiBurst'
import type { Food } from '../../types/index'

const CameraModal  = dynamic(() => import('../camera/CameraModal').then(m => m.CameraModal), { ssr: false })
const ChatLogModal = dynamic(() => import('../chat/ChatLogModal').then(m => m.ChatLogModal),  { ssr: false })
const AddFoodModal = dynamic(() => import('../log/AddFoodModal').then(m => m.AddFoodModal),   { ssr: false })

// One per step, in STEP_LABELS order.
const STEP_EMOJIS = ['📸', '👤', '📏', '🏃', '🚧', '📊']

const selectClass =
  'w-full rounded-control border border-hairline bg-surface-2 px-4 py-2.5 text-body font-semibold text-ink outline-none transition-all focus:border-brand focus:ring-[3px] focus:ring-brand-ring'

const pillBase =
  'rounded-control border px-3 py-3 text-body font-semibold capitalize transition-all'
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
      activity_level: 'moderate',
      pace_kg_per_week: 0.5,
    },
  })

  const {
    step, isNavigating, heightFt, setHeightFt, heightIn, setHeightIn,
    nextStep, prevStep, clearDraft,
  } = useOnboardingDraft(form)

  const selectedObstacles = form.watch('obstacles') ?? []

  /** Toggle one obstacle chip, refusing silently once MAX_OBSTACLES are held. */
  const toggleObstacle = (id: ObstacleId) => {
    const current = form.getValues('obstacles') ?? []
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : current.length >= MAX_OBSTACLES
        ? current
        : [...current, id]
    // shouldDirty so the draft-persist effect in useOnboardingDraft picks this
    // up — without it a refresh mid-wizard loses the chips but keeps the rest.
    form.setValue('obstacles', next, { shouldDirty: true })
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
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-title-lg">
              🎉
            </div>
            <h2 className="mt-5 font-display text-title-lg font-bold text-ink">Building your plan…</h2>
            <p className="mt-2 text-body text-ink-2">Working out your targets.</p>
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-title-sm">{STEP_EMOJIS[step - 1]}</span>
          <span className="text-caption font-semibold text-brand-ink tabular-nums">{step} / {TOTAL_STEPS}</span>
        </div>
        <div className="h-1.5 rounded-full bg-brand-soft overflow-hidden">
          <div
            className="h-full rounded-full bg-brand transition-all duration-500 ease-spring"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-2 text-body font-semibold text-ink">{STEP_LABELS[step - 1]}</p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Step 1: Log a meal — the activation moment, before any biometrics */}
        {step === 1 && (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft">
              <span className="text-title-lg">📸</span>
            </div>
            <div>
              <h2 className="font-display text-title-sm font-bold text-ink">What did you eat recently?</h2>
              <p className="mt-1 text-body text-ink-2">See how fast this is — then we&apos;ll set up your goals in under a minute.</p>
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
                  <p className="text-body font-semibold text-ink">Take a photo</p>
                  <p className="text-caption text-ink-2">Snap your plate — AI reads the macros</p>
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
                  <p className="text-body font-semibold text-ink">Describe it</p>
                  <p className="text-caption text-ink-2">&quot;2 roti, dal, sabzi&quot; — type it in</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Name */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-body font-semibold text-ink mb-1">What should we call you?</label>
              <Input {...form.register('display_name')} placeholder="Your name" />
              {form.formState.errors.display_name && (
                <p className="mt-1 text-caption text-danger">{form.formState.errors.display_name.message}</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2 (cont.): Age + Sex */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-body font-semibold text-ink mb-1">Age</label>
              <Input type="number" {...form.register('age', { valueAsNumber: true })} placeholder="25" />
              {form.formState.errors.age && (
                <p className="mt-1 text-caption text-danger">{form.formState.errors.age.message}</p>
              )}
            </div>
            <div>
              <label className="block text-body font-semibold text-ink mb-1">Biological sex</label>
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
              <label className="block text-body font-semibold text-ink mb-1.5">Height</label>
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
                <p className="mt-1 text-caption text-danger">{form.formState.errors.height_cm.message}</p>
              )}
            </div>
            <div>
              <label className="block text-body font-semibold text-ink mb-1">Current weight (kg)</label>
              <Input type="number" {...form.register('current_weight_kg', { valueAsNumber: true })} placeholder="70" />
              {form.formState.errors.current_weight_kg && (
                <p className="mt-1 text-caption text-danger">{form.formState.errors.current_weight_kg.message}</p>
              )}
            </div>
          </div>
        )}

        {/* Step 3 (cont.): Target weight + Goal */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="block text-body font-semibold text-ink mb-1">Target weight (kg)</label>
              <Input type="number" {...form.register('target_weight_kg', { valueAsNumber: true })} placeholder="65" />
              {form.formState.errors.target_weight_kg && (
                <p className="mt-1 text-caption text-danger">{form.formState.errors.target_weight_kg.message}</p>
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
                      <span className="text-caption text-ink-2">Your current BMI</span>
                      <span className={`text-caption font-bold ${bmiColor}`}>{currentBmi} · {bmiLabel}</span>
                    </div>
                    <p className="text-micro text-ink-2">
                      Healthy range for your height: <span className="font-semibold text-ink">{minHealthy}–{maxHealthy} kg</span> (BMI 18.5–24.9)
                    </p>
                    <div>
                      <p className="text-micro font-semibold uppercase tracking-caps text-ink-2 mb-1.5">Suggested targets</p>
                      <div className="flex gap-2">
                        {suggestions.map((s) => (
                          <button
                            key={s.bmi}
                            type="button"
                            onClick={() => form.setValue('target_weight_kg', s.kg, { shouldValidate: true })}
                            className="flex-1 rounded-control border border-hairline bg-surface py-1.5 text-center hover:border-brand tap-scale transition-all"
                          >
                            <p className="text-caption font-bold text-brand-ink tabular-nums">{s.kg} kg</p>
                            <p className="text-micro text-ink-2">BMI {s.bmi}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
            <div>
              <label className="block text-body font-semibold text-ink mb-1">Goal</label>
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

        {/* Step 4: Activity + Pace */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <label className="block text-body font-semibold text-ink mb-2">Activity level</label>
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
                    <span className="text-title-sm">{a.emoji}</span>
                    <div>
                      <p className={`text-body font-semibold ${form.watch('activity_level') === a.value ? 'text-brand-ink' : 'text-ink'}`}>{a.label}</p>
                      <p className="text-caption text-ink-2">{a.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-body font-semibold text-ink mb-1">Goal pace (kg/week)</label>
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
        {step === 4 && tdeePreview && (
          <div className="rounded-card border border-hairline bg-energy-soft p-4">
            <p className="text-caption font-semibold uppercase tracking-caps text-energy-ink mb-2">Your personalised targets</p>
            <div className="flex items-baseline gap-1.5 mb-3">
              <span className="font-display text-title-lg font-bold text-ink tabular-nums">{tdeePreview.daily_calorie_target.toLocaleString()}</span>
              <span className="text-body text-energy-ink font-semibold">kcal / day</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-control bg-surface py-2 text-center">
                <p className="text-body font-bold tabular-nums" style={{ color: 'var(--protein)' }}>{tdeePreview.protein_g_target}g</p>
                <p className="text-micro font-semibold text-ink-2">Protein</p>
              </div>
              <div className="rounded-control bg-surface py-2 text-center">
                <p className="text-body font-bold tabular-nums" style={{ color: 'var(--carbs)' }}>{tdeePreview.carbs_g_target}g</p>
                <p className="text-micro font-semibold text-ink-2">Carbs</p>
              </div>
              <div className="rounded-control bg-surface py-2 text-center">
                <p className="text-body font-bold tabular-nums" style={{ color: 'var(--fat)' }}>{tdeePreview.fat_g_target}g</p>
                <p className="text-micro font-semibold text-ink-2">Fat</p>
              </div>
            </div>
            {goalProjection && (
              <div className="mt-3 rounded-control bg-surface p-3 text-center">
                <p className="text-caption font-bold text-brand-ink">
                  🎯 At this pace, you&apos;ll reach {watchedValues.target_weight_kg} kg by ~{formatGoalDate(goalProjection.date)}
                </p>
              </div>
            )}
            <p className="mt-2 text-micro text-energy-ink">
              Mifflin-St Jeor formula, protein at {PROTEIN_G_PER_KG} g per kg of bodyweight.
              You can adjust this anytime in settings.
            </p>
          </div>
        )}

        {/* Step 5: Obstacles — multi-select, up to MAX_OBSTACLES.
            Everything the plan needs was captured by step 4, so this is
            genuinely optional: it changes the words on the plan reveal, never
            the numbers. Single-tap by design — a screen asking someone to type
            out why they have failed before is a screen they close. */}
        {step === 5 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-title-sm font-bold text-ink">What usually gets in the way?</h2>
              <p className="mt-1 text-body text-ink-2">
                Pick up to {MAX_OBSTACLES}. We&apos;ll aim your plan at these — skip if none fit.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {OBSTACLES.map((o) => {
                const chosen = selectedObstacles.includes(o.id)
                const atLimit = selectedObstacles.length >= MAX_OBSTACLES && !chosen
                return (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={chosen}
                    disabled={atLimit}
                    onClick={() => toggleObstacle(o.id)}
                    className={`flex flex-col items-start gap-1.5 rounded-control border px-3.5 py-3 text-left transition-all ${
                      chosen ? pillOn : pillOff
                    } ${atLimit ? 'opacity-40' : ''}`}
                  >
                    <span className="text-title-sm">{o.emoji}</span>
                    <span className={`text-caption font-semibold ${chosen ? 'text-brand-ink' : 'text-ink'}`}>
                      {o.label}
                    </span>
                  </button>
                )
              })}
            </div>
            <p className="text-micro text-ink-3" aria-live="polite">
              {selectedObstacles.length}/{MAX_OBSTACLES} chosen
            </p>
          </div>
        )}

        {/* Step 6: Tracking history. Someone who has tried and stopped needs
            the opposite reassurance from a first-timer, and the app used to
            write one line for both. Also optional. */}
        {step === 6 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-display text-title-sm font-bold text-ink">Have you counted calories before?</h2>
              <p className="mt-1 text-body text-ink-2">There&apos;s no wrong answer — it just changes where we start you.</p>
            </div>
            <div className="space-y-2">
              {TRACKING_EXPERIENCES.map((t) => {
                const chosen = form.watch('tracking_experience') === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={chosen}
                    onClick={() =>
                      // Tapping the chosen one again clears it — otherwise the
                      // only way to un-answer an optional question is to
                      // restart onboarding.
                      form.setValue('tracking_experience', chosen ? undefined : t.id)
                    }
                    className={`w-full flex items-center gap-3 rounded-control border px-4 py-3 text-left transition-all ${
                      chosen ? pillOn : pillOff
                    }`}
                  >
                    <span className="text-title-sm">{t.emoji}</span>
                    <p className={`text-body font-semibold ${chosen ? 'text-brand-ink' : 'text-ink'}`}>{t.label}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={prevStep}
            disabled={step === 1}
            className="flex items-center gap-1 rounded-control px-4 py-2.5 text-body font-semibold text-ink-2 hover:bg-surface-2 disabled:opacity-0 transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          {step === 1 ? (
            <button
              type="button"
              onClick={nextStep}
              disabled={isNavigating}
              className="rounded-control px-4 py-2.5 text-body font-semibold text-ink-2 hover:bg-surface-2 transition-all disabled:opacity-50"
            >
              Skip for now
            </button>
          ) : step < TOTAL_STEPS ? (
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

      {showCamera && (
        <CameraModal
          onClose={() => {
            setShowCamera(false)
            if (barcodeHandoffRef.current) { barcodeHandoffRef.current = false; return }
            nextStep()
          }}
          onFoodFound={(food) => { barcodeHandoffRef.current = true; setBarcodeFood(food) }}
        />
      )}
      {showChat && <ChatLogModal onClose={() => { setShowChat(false); nextStep() }} />}
      {barcodeFood && (
        <AddFoodModal food={barcodeFood} onClose={() => { setBarcodeFood(null); nextStep() }} />
      )}
    </div>
  )
}
