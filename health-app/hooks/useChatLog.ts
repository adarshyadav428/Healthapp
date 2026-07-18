'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../components/ui/use-toast'
import { captureEvent, logMetaHeaders } from '../lib/posthog/client'
import { reportLogMilestone } from '../store/milestoneStore'
import { openSaveAccount } from '../store/saveAccountStore'
import { coachingLine } from '../lib/coaching'
import { useUser } from './useUser'

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

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
}

export type State =
  | { type: 'idle' }
  | { type: 'analyzing'; message: string }
  | { type: 'confirm'; message: string; meal: Meal; items: FoodItem[] }
  | { type: 'logging'; meal: Meal; items: FoodItem[]; message: string }
  | { type: 'done'; logged: number; kcal: number; meal: Meal }

// NOTE: dinner cutoff is <20 here, unlike lib/meal's mealForTime (<21). This
// long-standing discrepancy is preserved deliberately so the chat-log refactor
// changes no behaviour; unifying it is a separate product decision.
function inferMeal(): Meal {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 20) return 'dinner'
  return 'snack'
}

type Params = { onClose: () => void; logDate?: string }

/**
 * Chat meal-logging orchestration: the analyze→confirm→log state machine and
 * the two server flows (/api/chat/analyze incl. the 429 paywall, and the bulk
 * log write incl. per-item correction analytics). Extracted from ChatLogModal
 * so the component is pure presentation. Behaviour is intentionally identical.
 */
export function useChatLog({ onClose, logDate }: Params) {
  const router = useRouter()
  const { profile } = useUser()
  const queryClient = useQueryClient()
  const [state, setState] = useState<State>({ type: 'idle' })
  const [input, setInput] = useState('')

  const handleSend = async () => {
    const message = input.trim()
    if (!message) return
    setState({ type: 'analyzing', message })
    setInput('')

    try {
      const now = new Date()
      const currentTime = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
      const res = await fetch('/api/chat/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, currentTime }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403 && data.createAccount) {
          onClose()
          openSaveAccount('chat_log')
          setState({ type: 'idle' })
          setInput(message)
          return
        }
        if (res.status === 429) {
          toast({
            title: 'Daily chat-log limit reached',
            description: 'Upgrade to Pro for unlimited AI meal logging.',
            variant: 'error',
            action: {
              label: 'Upgrade',
              altText: 'Go to upgrade page',
              onClick: () => { onClose(); router.push('/upgrade?reason=chat_scan_limit') },
            },
          })
        } else {
          toast({ title: 'Could not analyse meal', description: data.error, variant: 'error' })
        }
        setState({ type: 'idle' })
        setInput(message)
        return
      }
      const meal = (data.meal?.toLowerCase() ?? inferMeal()) as Meal
      const items: FoodItem[] = (data.items as FoodItem[]).map((item) => ({ ...item, originalGrams: item.grams }))
      setState({ type: 'confirm', message, meal, items })
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

  const removeItem = (idx: number) => {
    if (state.type !== 'confirm') return
    const items = state.items.filter((_, i) => i !== idx)
    if (!items.length) { setState({ type: 'idle' }); return }
    setState({ ...state, items })
  }

  const handleLog = async () => {
    if (state.type !== 'confirm') return
    const { meal, items, message } = state
    setState({ type: 'logging', meal, items, message })
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
        })
      }

      const totalKcal = Math.round(items.reduce((sum, i) => sum + (i.food.kcal_per_100g * i.grams / 100), 0))
      setState({ type: 'done', logged: items.length, kcal: totalKcal, meal })
    } catch (err) {
      toast({ title: 'Log failed', description: (err as Error).message, variant: 'error' })
      setState(s => s.type === 'logging' ? { type: 'confirm', message: s.message, meal: s.meal, items: s.items } : s)
    }
  }

  const totalKcal = state.type === 'confirm'
    ? Math.round(state.items.reduce((sum, i) => sum + (i.food.kcal_per_100g * i.grams / 100), 0))
    : 0
  const totalProtein = state.type === 'confirm'
    ? Math.round(state.items.reduce((sum, i) => sum + (i.food.protein_g_per_100g * i.grams / 100), 0))
    : 0
  // One warm coaching sentence, computed locally from totals + targets (no AI call).
  const coaching = state.type === 'confirm' && profile
    ? coachingLine(
        { kcal: totalKcal, protein: totalProtein },
        { kcal: profile.daily_calorie_target, protein: profile.protein_g_target }
      )
    : null

  return {
    state, setState, input, setInput,
    handleSend, updateGrams, removeItem, handleLog,
    totalKcal, coaching,
  }
}
