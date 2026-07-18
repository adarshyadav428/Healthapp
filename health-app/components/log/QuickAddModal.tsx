'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../ui/use-toast'
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet'
import { Button } from '../ui/button'
import { X, Zap, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'
import { reportLogMilestone } from '../../store/milestoneStore'
import type { LogMilestone } from '../../lib/logMilestones'
import { mealForTime } from '../../lib/meal'

const MEALS = [
  { value: 'breakfast', label: '🥣 Breakfast' },
  { value: 'lunch',     label: '🍛 Lunch' },
  { value: 'dinner',    label: '🍲 Dinner' },
  { value: 'snack',     label: '🥜 Snack' },
] as const

type Meal = (typeof MEALS)[number]['value']

export function QuickAddModal({ onClose, logDate }: { onClose: () => void; logDate?: string }) {
  const [kcal,    setKcal]    = useState('')
  const [meal,    setMeal]    = useState<Meal>(mealForTime())
  const [showMacros, setShowMacros] = useState(false)
  const [protein, setProtein] = useState('')
  const [carbs,   setCarbs]   = useState('')
  const [fat,     setFat]     = useState('')
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)

  const kcalNum = parseInt(kcal, 10)
  const valid   = !isNaN(kcalNum) && kcalNum > 0 && kcalNum <= 5000

  const handleAdd = async () => {
    if (!valid || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/logs/quick-add', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          kcal:    kcalNum,
          protein: parseFloat(protein) || 0,
          carbs:   parseFloat(carbs)   || 0,
          fat:     parseFloat(fat)     || 0,
          meal,
          date:    logDate,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; milestone?: LogMilestone }
      if (!res.ok) throw new Error(body?.error ?? 'Failed')
      toast({ title: `✓ ${kcalNum} kcal added`, description: `Logged to ${meal}`, duration: 2000 })
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      reportLogMilestone(body.milestone)
      onClose()
    } catch (err) {
      toast({ title: 'Failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="pt-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <SheetTitle>Quick Add</SheetTitle>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-surface-2 transition-colors"
          >
            <X className="h-5 w-5 text-ink-2" />
          </button>
        </div>

        {/* Calorie input — huge, thumb-friendly */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-baseline gap-2">
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              autoFocus
              className="font-display w-40 bg-transparent text-center text-7xl font-bold tabular-nums text-ink outline-none placeholder:text-hairline"
            />
            <span className="text-xl font-bold text-ink-2">kcal</span>
          </div>
          {kcalNum > 5000 && (
            <p className="text-xs text-danger mt-1">Max 5,000 kcal</p>
          )}
        </div>

        {/* Meal selector */}
        <div className="grid grid-cols-4 gap-1.5 mb-5">
          {MEALS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMeal(m.value)}
              className={cn(
                'rounded-control py-2 text-xs font-semibold transition-all border',
                meal === m.value
                  ? 'bg-brand-soft text-brand-ink border-brand'
                  : 'bg-surface-2 text-ink-2 border-hairline'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Optional macros toggle */}
        <button
          type="button"
          onClick={() => setShowMacros((v) => !v)}
          className="flex items-center gap-1 text-xs font-semibold text-ink-2 mb-3"
        >
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showMacros && 'rotate-180')} />
          {showMacros ? 'Hide macros' : 'Add macros (optional)'}
        </button>

        {showMacros && (
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              { label: 'Protein (g)', value: protein, set: setProtein },
              { label: 'Carbs (g)',   value: carbs,   set: setCarbs },
              { label: 'Fat (g)',     value: fat,     set: setFat },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="block text-[10px] font-semibold text-ink-2 uppercase tracking-wide mb-1">{label}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-control border border-hairline bg-surface-2 px-3 py-2.5 text-sm font-bold text-center text-ink outline-none focus:border-brand focus:ring-[3px] focus:ring-brand-ring transition-all"
                />
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <Button
          type="button"
          size="lg"
          disabled={!valid || loading}
          onClick={handleAdd}
          className="w-full gap-2 tap-scale"
        >
          <Zap className="h-5 w-5" />
          {loading ? 'Adding…' : `Add ${valid ? kcalNum.toLocaleString() : '—'} kcal`}
        </Button>
      </SheetContent>
    </Sheet>
  )
}
