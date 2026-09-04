'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../components/ui/use-toast'
import { captureEvent, logMetaHeaders, markLogStart } from '../lib/posthog/client'
import { reportLogMilestone } from '../store/milestoneStore'
import { coachingLine, dayContextFor } from '../lib/coaching'
import { dateStrToUtcMidnight, formatIst } from '../lib/dateUtils'
import { mealForTime, type Meal } from '../lib/meal'
import { useUser } from './useUser'
import { useDailyTotals } from './useDailyTotals'
import { resolveAiGateAction } from '../lib/aiGateRedirect'
import { recordAiVerificationBlock } from '../lib/verifyPromptStore'

// Re-exported, not redeclared. This file held a structurally identical copy,
// which is how the private `inferMeal` below looked like it belonged here.
export type { Meal }

export type FoodItem = {
  food: {
    id: string
    name: string
    kcal_per_100g: number
    protein_g_per_100g: number
    carbs_g_per_100g: number
    fat_g_per_100g: number
  }
  grams: number
  /** AI's original suggestion — kept alongside `grams` so we can tell if the user corrected it. */
  originalGrams: number
  portion_desc: string
  /** How sure the model was — surfaced as a "rough estimate" pill when 'low'. */
  confidence?: 'low' | 'medium' | 'high'
  /** Set only for a naturally-countable item (chicken pieces, paneer cubes) —
   *  drives a "− N pieces +" stepper instead of a gram slider. `grams` stays
   *  the source of truth for nutrition; `count` is a display/editing aid. */
  unit?: 'g' | 'pcs'
  count?: number
  originalCount?: number
}

export type State =
  | { type: 'idle' }
  | { type: 'analyzing'; message: string }
  | { type: 'confirm'; message: string; meal: Meal; items: FoodItem[]; assumptions?: string | null }
  | { type: 'logging'; meal: Meal; items: FoodItem[]; message: string; assumptions?: string | null }
  | { type: 'done'; logged: number; kcal: number; meal: Meal }

// A private `inferMeal` lived here until 2026-09-04 — a seventh copy of the
// rule `lib/meal.ts` exists to hold, and it disagreed with that rule in BOTH
// directions: 17:00–18:00 went to dinner where every other surface says snack,
// and 20:00–23:00 went to snack where every other surface says dinner. The
// second is the behaviour `lib/meal.ts` explicitly removed ("late night stays
// dinner"). Its own comment defended the gap by citing a "<21 boundary" in
// `mealForTime` that has never existed. Fires only when the model returns no
// meal, which is why it survived — audit 2026-09-03, P2-5.

type Params = {
  onClose: () => void
  logDate?: string
  /** See useCameraScan — `'onboarding'` keeps a gated scan in the wizard. */
  context?: 'standalone' | 'onboarding'
}

/**
 * Chat meal-logging orchestration: the analyze→confirm→log state machine and
 * the two server flows (/api/chat/analyze incl. the 429 paywall, and the bulk
 * log write incl. per-item correction analytics). Extracted from ChatLogModal
 * so the component is pure presentation. Behaviour is intentionally identical.
 */
export function useChatLog({ onClose, logDate, context = 'standalone' }: Params) {
  // Start the clock for `seconds_to_log`: this surface opening is the moment
  // the user set out to log something. See markLogStart in lib/posthog/client.
  useEffect(() => { markLogStart() }, [])
  const router = useRouter()
  const { user, profile } = useUser()
  // The day being logged TO, not the day it happens to be. The Food tab's day
  // nav can point this at a past date, and totals for the wrong day are worse
  // than none — they read as authoritative while describing someone else's meal.
  const { totals: dailyTotals, isLoading: totalsLoading, error: totalsError } = useDailyTotals(
    user?.id ?? null,
    logDate ? dateStrToUtcMidnight(logDate) : undefined
  )
  const queryClient = useQueryClient()
  const [state, setState] = useState<State>({ type: 'idle' })
  const [input, setInput] = useState('')
  // Free AI scans left after the most recent scan. null = Pro, or not yet known
  // (the count only rides back on a scan response). See lib/aiTrial.
  const [scansLeft, setScansLeft] = useState<number | null>(null)

  const handleSend = async () => {
    const message = input.trim()
    if (!message) return
    setState({ type: 'analyzing', message })
    setInput('')

    try {
      // The clock the model infers a meal type from has to be the same clock
      // the log is filed under — IST. In the device's zone an NRI's 9pm dinner
      // arrived as 06:30, and came back tagged breakfast.
      const currentTime = formatIst(new Date(), { hour: '2-digit', minute: '2-digit' })
      const res = await fetch('/api/chat/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, currentTime }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Gated. Standalone: straight to the paywall, no intermediate toast.
        // Onboarding: stay in the wizard with an inline note — redirecting here
        // ejects every new, unverified user off the flow they signed up for.
        if (res.status === 403 && data.upgrade) {
          setState({ type: 'idle' })
          setInput(message)
          if (data.block === 'unverified' && user?.id) recordAiVerificationBlock(user.id)
          const action = resolveAiGateAction({ block: data.block, scan: 'chat', context })
          onClose()
          if (action.kind === 'redirect') router.push(action.href)
          else toast({ title: action.message, duration: 5000 })
          return
        }
        {
          toast({ title: 'Could not analyse meal', description: data.error, variant: 'error' })
        }
        setState({ type: 'idle' })
        setInput(message)
        return
      }
      if (typeof data.remaining === 'number') setScansLeft(data.remaining)
      const meal = (data.meal?.toLowerCase() ?? mealForTime()) as Meal
      const items: FoodItem[] = (data.items as FoodItem[]).map((item) => ({
        ...item,
        originalGrams: item.grams,
        originalCount: item.count,
      }))
      setState({ type: 'confirm', message, meal, items, assumptions: data.assumptions ?? null })
    } catch {
      toast({ title: 'Network error', description: 'Please try again.', variant: 'error' })
      setState({ type: 'idle' })
      setInput(message)
    }
  }

  const updateGrams = (idx: number, grams: number) => {
    if (state.type !== 'confirm') return
    const items = state.items.map((item, i) => i === idx ? { ...item, grams } : item)
    setState({ ...state, items })
  }

  // Pieces-based editing for a "unit: pcs" item (e.g. chicken pieces). Grams
  // stay the actual source of truth for nutrition — this just recomputes them
  // from a stable per-piece weight, so "6 pieces" -> "8 pieces" scales the
  // kcal the same way the slider would, without the user ever entering grams.
  const updateCount = (idx: number, count: number) => {
    if (state.type !== 'confirm') return
    const items = state.items.map((item, i) => {
      if (i !== idx || !item.originalCount) return item
      const gramsPerUnit = item.originalGrams / item.originalCount
      return { ...item, count, grams: Math.max(1, Math.round(gramsPerUnit * count)) }
    })
    setState({ ...state, items })
  }

  const removeItem = (idx: number) => {
    if (state.type !== 'confirm') return
    const items = state.items.filter((_, i) => i !== idx)
    if (!items.length) { setState({ type: 'idle' }); return }
    setState({ ...state, items })
  }

  const handleLog = async () => {
    if (state.type !== 'confirm') return
    const { meal, items, message, assumptions } = state
    setState({ type: 'logging', meal, items, message, assumptions })
    try {
      const res = await fetch('/api/logs/add-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...logMetaHeaders('chat') },
        body: JSON.stringify({
          items: items.map(i => ({ food_id: i.food.id, grams: i.grams, meal })),
          date: logDate,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      queryClient.invalidateQueries({ queryKey: ['logs'] })
      queryClient.invalidateQueries({ queryKey: ['dailyTotals'] })
      reportLogMilestone(data.milestone)

      // Correction signal per item: did the user adjust the AI's suggested portion?
      for (const item of items) {
        captureEvent('ai_estimate_corrected', {
          type: 'chat',
          corrected: item.grams !== item.originalGrams,
          original_name: item.food.name,
          original_grams: item.originalGrams,
          corrected_grams: item.grams,
          delta_grams: item.grams - item.originalGrams,
          confidence: item.confidence ?? null,
        })
      }

      const totalKcal = Math.round(items.reduce((sum, i) => sum + (i.food.kcal_per_100g * i.grams / 100), 0))
      setState({ type: 'done', logged: items.length, kcal: totalKcal, meal })
    } catch (err) {
      toast({ title: 'Log failed', description: (err as Error).message, variant: 'error' })
      setState(s => s.type === 'logging' ? { type: 'confirm', message: s.message, meal: s.meal, items: s.items, assumptions: s.assumptions } : s)
    }
  }

  const totalKcal = state.type === 'confirm'
    ? Math.round(state.items.reduce((sum, i) => sum + (i.food.kcal_per_100g * i.grams / 100), 0))
    : 0
  const totalProtein = state.type === 'confirm'
    ? Math.round(state.items.reduce((sum, i) => sum + (i.food.protein_g_per_100g * i.grams / 100), 0))
    : 0
  // One warm coaching sentence, computed locally from totals + targets (no AI
  // call). The day's logged totals go in as the "before this meal" figure so
  // the line talks about the budget actually left, instead of describing a
  // snack as "a light 12% of your day" to someone already over.
  //
  // dayContextFor drops the context entirely while the totals are loading or if
  // the read failed — see its comment for why zeros must not be passed through.
  const dayContext = dayContextFor({
    totals: dailyTotals,
    isLoading: totalsLoading,
    error: totalsError,
  })
  const coaching = state.type === 'confirm' && profile
    ? coachingLine(
        { kcal: totalKcal, protein: totalProtein },
        { kcal: profile.daily_calorie_target, protein: profile.protein_g_target },
        dayContext
      )
    : null

  return {
    state, setState, input, setInput, scansLeft,
    handleSend, updateGrams, updateCount, removeItem, handleLog,
    totalKcal, coaching,
  }
}
