'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { X, Send, Loader2, RotateCcw, CheckCircle, MessageSquarePlus } from 'lucide-react'
import { toast } from '../ui/use-toast'
import { Sheet, SheetContent } from '../ui/sheet'
import { Button } from '../ui/button'
import { captureEvent } from '../../lib/posthog/client'
import { reportLogMilestone } from '../../store/milestoneStore'
import { coachingLine } from '../../lib/coaching'
import { useUser } from '../../hooks/useUser'

type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack'

type FoodItem = {
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

type State =
  | { type: 'idle' }
  | { type: 'analyzing'; message: string }
  | { type: 'confirm'; message: string; meal: Meal; items: FoodItem[] }
  | { type: 'logging'; meal: Meal; items: FoodItem[]; message: string }
  | { type: 'done'; logged: number; kcal: number; meal: Meal }

const MEAL_OPTIONS: { value: Meal; label: string }[] = [
  { value: 'breakfast', label: '🌅 Breakfast' },
  { value: 'lunch', label: '🍱 Lunch' },
  { value: 'dinner', label: '🌙 Dinner' },
  { value: 'snack', label: '🍎 Snack' },
]

function inferMeal(): Meal {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 20) return 'dinner'
  return 'snack'
}

function round1(n: number) { return Math.round(n * 10) / 10 }

export function ChatLogModal({ onClose, logDate }: { onClose: () => void; logDate?: string }) {
  const router = useRouter()
  const { profile } = useUser()
  const queryClient = useQueryClient()
  const [state, setState] = useState<State>({ type: 'idle' })
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
        headers: { 'Content-Type': 'application/json' },
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

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent title="Log a meal with AI" className="sm:max-w-lg flex flex-col max-h-[90vh] p-0 pt-3">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-hairline">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-brand" />
            <h2 className="font-display text-base font-bold text-ink">Log with AI</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-surface-2 transition-colors">
            <X className="h-4 w-4 text-ink-2" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* User message bubble */}
          {'message' in state && (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-card rounded-tr-sm bg-brand px-4 py-2.5 text-sm text-white">
                {(state as { message: string }).message}
              </div>
            </div>
          )}

          {/* Analyzing state */}
          {state.type === 'analyzing' && (
            <div className="flex items-center gap-2.5 text-sm text-ink-2">
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
              <span>Analysing your meal...</span>
            </div>
          )}

          {/* Confirm state */}
          {(state.type === 'confirm' || state.type === 'logging') && (
            <div className="space-y-3">
              {/* Meal selector */}
              <div className="flex gap-2 flex-wrap">
                {MEAL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => state.type === 'confirm' && setState({ ...state, meal: opt.value })}
                    className={`px-3 py-1.5 rounded-control text-xs font-semibold border transition-all ${
                      state.meal === opt.value
                        ? 'border-brand bg-brand-soft text-brand-ink'
                        : 'border-hairline text-ink-2 bg-surface-2'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Item list */}
              <div className="space-y-2">
                {state.type === 'confirm' && state.items.map((item, idx) => {
                  const itemKcal = Math.round(item.food.kcal_per_100g * item.grams / 100)
                  return (
                    <div key={idx} className="rounded-card border border-hairline bg-surface-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ink truncate">{item.food.name}</p>
                          <p className="text-xs text-ink-2 mt-0.5">{item.portion_desc}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-bold text-brand-ink tabular-nums">{itemKcal} kcal</span>
                          <button
                            onClick={() => removeItem(idx)}
                            className="rounded-full p-1 hover:bg-hairline transition-colors"
                          >
                            <X className="h-3.5 w-3.5 text-ink-2" />
                          </button>
                        </div>
                      </div>
                      {/* Grams slider */}
                      <div className="mt-2.5 flex items-center gap-2.5">
                        <input
                          type="range"
                          min={10}
                          max={600}
                          step={5}
                          value={item.grams}
                          onChange={(e) => updateGrams(idx, Number(e.target.value))}
                          className="flex-1 accent-brand"
                        />
                        <span className="text-xs font-bold text-ink w-12 text-right tabular-nums">{item.grams}g</span>
                      </div>
                      <div className="mt-1 flex gap-3 text-[11px] text-ink-2 tabular-nums">
                        <span style={{ color: 'var(--protein)' }}>P {round1(item.food.protein_g_per_100g * item.grams / 100)}g</span>
                        <span style={{ color: 'var(--carbs)' }}>C {round1(item.food.carbs_g_per_100g * item.grams / 100)}g</span>
                        <span style={{ color: 'var(--fat)' }}>F {round1(item.food.fat_g_per_100g * item.grams / 100)}g</span>
                      </div>
                    </div>
                  )
                })}

                {state.type === 'logging' && (
                  <div className="flex items-center gap-2 text-sm text-ink-2 py-2">
                    <Loader2 className="h-4 w-4 animate-spin text-brand" />
                    <span>Logging your meal...</span>
                  </div>
                )}
              </div>

              {/* Post-scan coaching line — makes the AI feel like a coach */}
              {state.type === 'confirm' && coaching && (
                <p className="mb-2 px-1 text-[12.5px] leading-relaxed text-ink-2">💡 {coaching}</p>
              )}

              {/* Total + actions */}
              {state.type === 'confirm' && (
                <div className="rounded-card bg-energy-soft border border-hairline p-3">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold text-energy-ink">Total</span>
                    <span className="font-display text-lg font-bold text-ink tabular-nums">{totalKcal} kcal</span>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleLog} className="flex-1 gap-1.5 tap-scale">
                      <CheckCircle className="h-4 w-4" />
                      Log {state.items.length} item{state.items.length > 1 ? 's' : ''}
                    </Button>
                    <Button variant="outline" onClick={() => setState({ type: 'idle' })} className="gap-1.5 tap-scale">
                      <RotateCcw className="h-3.5 w-3.5" />
                      Redo
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Done state */}
          {state.type === 'done' && (
            <div className="space-y-3">
              <div className="rounded-card border border-hairline p-4 text-center" style={{ background: 'color-mix(in srgb, var(--good) 8%, transparent)' }}>
                <CheckCircle className="h-8 w-8 text-good mx-auto mb-2" />
                <p className="text-sm font-bold text-good">
                  Logged {state.logged} item{state.logged > 1 ? 's' : ''} · {state.kcal} kcal
                </p>
                <p className="text-xs text-good mt-0.5 capitalize opacity-80">Added to {state.meal}</p>
              </div>
              <Button variant="outline" size="lg" onClick={() => setState({ type: 'idle' })} className="w-full tap-scale">
                Log another meal
              </Button>
            </div>
          )}

          {/* Idle hint */}
          {state.type === 'idle' && (
            <div className="rounded-card bg-surface-2 p-4">
              <p className="text-xs font-semibold text-ink-2 mb-2">Try saying:</p>
              {[
                '4 medium roti, aloo beans sabzi, 1 katori dal, 3 katori chawal',
                '2 paratha with curd and achar',
                'Poha with chai for breakfast',
              ].map(ex => (
                <button
                  key={ex}
                  onClick={() => setInput(ex)}
                  className="block w-full text-left text-xs text-brand-ink py-1.5 hover:underline"
                >
                  &ldquo;{ex}&rdquo;
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input area */}
        {(state.type === 'idle' || state.type === 'done') && (
          <div className="px-5 pb-6 pt-3 border-t border-hairline">
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder="Describe what you ate — e.g. 4 roti, dal, sabzi..."
                rows={2}
                className="flex-1 resize-none rounded-control border border-hairline bg-surface-2 px-4 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring transition-all"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-brand text-white hover:opacity-90 disabled:opacity-40 active:scale-95 transition-all"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
