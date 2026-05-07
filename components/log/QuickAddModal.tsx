'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../ui/use-toast'
import { X, Zap, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

const MEALS = [
  { value: 'breakfast', label: '🥣 Breakfast' },
  { value: 'lunch',     label: '🍛 Lunch' },
  { value: 'dinner',    label: '🍲 Dinner' },
  { value: 'snack',     label: '🥜 Snack' },
] as const

type Meal = (typeof MEALS)[number]['value']

function defaultMeal(): Meal {
  const h = new Date().getHours()
  if (h < 11) return 'breakfast'
  if (h < 16) return 'lunch'
  if (h < 21) return 'dinner'
  return 'snack'
}

export function QuickAddModal({ onClose }: { onClose: () => void }) {
  const [kcal,    setKcal]    = useState('')
  const [meal,    setMeal]    = useState<Meal>(defaultMeal())
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
        }),
      })
      const body = await res.json().catch(() => ({} as { error?: string }))
      if (!res.ok) throw new Error(body?.error ?? 'Failed')
      toast({ title: `✓ ${kcalNum} kcal added`, description: `Logged to ${meal}`, duration: 2000 })
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      onClose()
    } catch (err) {
      toast({ title: 'Failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-md rounded-t-[28px] bg-white dark:bg-slate-900 px-5 pt-4 pb-8 shadow-2xl animate-fade-up">
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-black">Quick Add</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5 text-muted" />
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
              className="w-40 bg-transparent text-center text-7xl font-black tabular-nums text-foreground outline-none placeholder:text-slate-200 dark:placeholder:text-slate-700"
            />
            <span className="text-xl font-bold text-muted">kcal</span>
          </div>
          {kcalNum > 5000 && (
            <p className="text-xs text-red-500 mt-1">Max 5,000 kcal</p>
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
                'rounded-xl py-2 text-xs font-semibold transition-all',
                meal === m.value
                  ? 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700'
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
          className="flex items-center gap-1 text-xs font-semibold text-muted mb-3"
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
                <label className="block text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">{label}</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm font-bold text-center outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 transition-all"
                />
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <button
          type="button"
          disabled={!valid || loading}
          onClick={handleAdd}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-4 text-[15px] font-black text-white shadow-lg shadow-orange-500/30 active:scale-[.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Zap className="h-5 w-5" />
          {loading ? 'Adding…' : `Add ${valid ? kcalNum.toLocaleString() : '—'} kcal`}
        </button>
      </div>
    </div>
  )
}
