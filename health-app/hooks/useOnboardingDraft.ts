'use client'

import { useEffect, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { OnboardingData } from '../lib/validations'
import { captureEvent } from '../lib/posthog/client'
import { EVENTS } from '../lib/posthog/events'

// Six screens: the activation log, three question screens, then two about the
// person rather than the body.
//
// This was six, then four — "each extra screen is a place to drop out", and at
// current scale the binding constraint is activation, not conversion. That
// reasoning still stands, so the two added back are held to a harder rule than
// the four that were cut: both are **single-tap** (no typing, no keyboard) and
// both **visibly change the plan reveal** two screens later. A question whose
// answer changes nothing the user sees does not earn a screen here.
//
// They sit last on purpose. Everything the plan actually needs is captured by
// step 4, so an abandoner at step 5 or 6 has still given us a complete profile
// — the fields are optional in the schema precisely so that stays true.
export const TOTAL_STEPS = 6
const ONBOARDING_STORAGE_KEY = 'gis.onboarding.progress'

export const STEP_LABELS = [
  'Log a meal',
  'About you',
  'Your body & goal',
  'Lifestyle',
  'What makes it hard',
  'Your experience',
]

// Which fields must validate before advancing past each step. Steps 5 and 6 are
// deliberately empty: both are skippable, and a required "why do you struggle"
// screen is a wall in front of a plan the user has already earned.
const fieldsByStep: Record<number, (keyof OnboardingData)[]> = {
  1: [],
  2: ['display_name', 'age', 'sex'],
  3: ['height_cm', 'current_weight_kg', 'target_weight_kg', 'goal'],
  4: ['activity_level', 'pace_kg_per_week'],
  5: [],
  6: [],
}

/**
 * Onboarding wizard progress: the current step + navigation (with per-step
 * validation and the step-completed analytics), the feet/inches height state,
 * and the localStorage resume/persist so a mid-wizard exit picks up where it
 * left off. Extracted from OnboardingForm so it's pure presentation.
 * Behaviour (storage key, validation gating, analytics) is intentionally identical.
 */
export function useOnboardingDraft(form: UseFormReturn<OnboardingData>) {
  const [step, setStep] = useState(1)
  const [isNavigating, setIsNavigating] = useState(false)
  const [heightFt, setHeightFt] = useState(5)
  const [heightIn, setHeightIn] = useState(7)

  // Resume where an abandoner left off instead of restarting at step 1/6.
  useEffect(() => {
    let resumedStep = 1
    try {
      const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as { step?: number; values?: Partial<OnboardingData>; heightFt?: number; heightIn?: number }
        if (saved.values) form.reset({ ...form.getValues(), ...saved.values })
        if (typeof saved.heightFt === 'number') setHeightFt(saved.heightFt)
        if (typeof saved.heightIn === 'number') setHeightIn(saved.heightIn)
        if (saved.step && saved.step >= 1 && saved.step <= TOTAL_STEPS) {
          resumedStep = saved.step
          setStep(saved.step)
        }
      }
    } catch { /* ignore */ }
    // Only a genuine start counts — resuming a half-finished wizard is not a
    // new `onboarding_started`, or the activation funnel double-counts.
    if (resumedStep === 1) captureEvent(EVENTS.ONBOARDING_STARTED)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const watchedValues = form.watch()

  // Persist progress (step + values) so a mid-wizard exit can resume.
  useEffect(() => {
    try {
      localStorage.setItem(
        ONBOARDING_STORAGE_KEY,
        JSON.stringify({ step, values: watchedValues, heightFt, heightIn })
      )
    } catch { /* ignore */ }
  }, [step, watchedValues, heightFt, heightIn])

  const nextStep = async () => {
    if (isNavigating) return
    setIsNavigating(true)
    try {
      const ok = await form.trigger(fieldsByStep[step])
      if (ok) {
        captureEvent(EVENTS.ONBOARDING_STEP_COMPLETED, { step, label: STEP_LABELS[step - 1] })
        setStep((s) => Math.min(TOTAL_STEPS, s + 1))
      }
    } finally {
      setIsNavigating(false)
    }
  }

  const prevStep = () => setStep((s) => Math.max(1, s - 1))

  // Clear the saved draft once onboarding is submitted successfully.
  const clearDraft = () => {
    try { localStorage.removeItem(ONBOARDING_STORAGE_KEY) } catch { /* ignore */ }
  }

  return {
    step, setStep, isNavigating,
    heightFt, setHeightFt, heightIn, setHeightIn,
    nextStep, prevStep, clearDraft,
  }
}
