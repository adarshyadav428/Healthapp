'use client'

import { useMemo, useState } from 'react'
import type { FoodLog } from '../../types/index'
import { useFoodLogs } from '../../hooks/useFoodLogs'
import { useUser } from '../../hooks/useUser'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../ui/use-toast'
import { getUtcDayRange } from '../../lib/dateUtils'
import { Trash2, ChevronDown, Pencil, BookmarkPlus, Check, X } from 'lucide-react'
import { EditFoodLogModal } from './EditFoodLogModal'

const MEAL_CONFIG: Record<string, { label: string; emoji: string; accent: string }> = {
  breakfast: { label: 'Breakfast', emoji: '🥣', accent: 'text-orange-700 dark:text-orange-400' },
  lunch:     { label: 'Lunch',     emoji: '🍛', accent: 'text-emerald-700 dark:text-emerald-400' },
  dinner:    { label: 'Dinner',    emoji: '🍲', accent: 'text-rose-700 dark:text-rose-400' },
  snack:     { label: 'Snacks',    emoji: '🥜', accent: 'text-amber-700 dark:text-amber-400' },
}

function MealGroup({ meal, logs, onDelete, deletingId, onEdit }: {
  meal: string
  logs: FoodLog[]
  onDelete: (id: string) => void
  deletingId: string | null
  onEdit: (log: FoodLog) => void
}) {
  const [open, setOpen] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [mealName, setMealName] = useState('')
  const cfg = MEAL_CONFIG[meal] ?? { label: meal, emoji: '🍽️', accent: 'text-muted' }
  const totalKcal = logs.reduce((s, l) => s + l.kcal, 0)

  const saveMeal = async () => {
    const name = mealName.trim() || cfg.label
    setSaving(true)
    try {
      const res = await fetch('/api/meals/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          items: logs.filter((l) => l.food_id != null).map((l) => ({ food_id: l.food_id!, grams: l.grams, servings: l.servings ?? 1 })),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')
      toast({ title: `"${name}" saved!`, description: 'Log it again anytime from the search screen.', duration: 3000 })
      setSavingName(false)
      setMealName('')
    } catch (err) {
      toast({ title: 'Save failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{cfg.emoji}</span>
          <span className={`text-xs font-bold ${cfg.accent}`}>{cfg.label}</span>
          <span className="text-xs text-muted">· {logs.length} item{logs.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted">{Math.round(totalKcal)} kcal</span>
          <ChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="px-3 pb-2 space-y-1.5 border-t border-gray-50 dark:border-slate-800 pt-1.5">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-slate-800 px-3 py-2">
              <div className="min-w-0 flex-1 mr-2">
                <p className="text-xs font-semibold text-foreground truncate">{log.food?.name ?? (log.food_id == null ? 'Quick Add' : 'Food item')}</p>
                <div className="flex gap-2 mt-0.5 flex-wrap">
                  <span className="text-[10px] font-bold text-foreground">{Math.round(log.kcal)} kcal</span>
                  <span className="text-[10px] text-blue-500 dark:text-blue-400">P{Math.round(log.protein_g)}g</span>
                  <span className="text-[10px] text-amber-500 dark:text-amber-400">C{Math.round(log.carbs_g)}g</span>
                  <span className="text-[10px] text-rose-500 dark:text-rose-400">F{Math.round(log.fat_g)}g</span>
                  {log.food?.fiber_g_per_100g != null && log.food.fiber_g_per_100g > 0 && (
                    <span className="text-[10px] text-emerald-500 dark:text-emerald-400">
                      Fi{Math.round(log.food.fiber_g_per_100g * log.grams / 100)}g
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => onEdit(log)}
                  className="rounded-full p-1 text-muted hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
                  aria-label="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(log.id)}
                  disabled={deletingId === log.id}
                  className="rounded-full p-1 text-muted hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-40 transition-colors"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          {/* Save as meal */}
          {savingName ? (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                placeholder={`Name (e.g. "${cfg.label} usual")`}
                className="flex-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-1.5 text-xs text-foreground outline-none focus:border-orange-400 transition-all"
                onKeyDown={(e) => e.key === 'Enter' && saveMeal()}
                autoFocus
              />
              <button type="button" onClick={saveMeal} disabled={saving}
                className="rounded-xl bg-orange-600 px-2.5 py-1.5 text-white hover:bg-orange-700 disabled:opacity-50 transition-colors">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => setSavingName(false)}
                className="rounded-xl px-2.5 py-1.5 text-muted hover:text-foreground hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSavingName(true)}
              className="flex w-full items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold text-muted hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-colors"
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
              Save as meal template
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function TodayFoodLog({ initialLogs }: { initialLogs: FoodLog[] }) {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { data: logs = initialLogs } = useFoodLogs(user?.id ?? null, new Date(), initialLogs)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingLog, setEditingLog] = useState<FoodLog | null>(null)

  const byMeal = useMemo(() => {
    const order = ['breakfast', 'lunch', 'dinner', 'snack']
    const groups: Record<string, FoodLog[]> = {}
    for (const log of logs) {
      if (!groups[log.meal]) groups[log.meal] = []
      groups[log.meal].push(log)
    }
    return order.filter((m) => groups[m]?.length > 0).map((m) => ({ meal: m, logs: groups[m] }))
  }, [logs])

  const totals = useMemo(() => ({
    kcal: logs.reduce((s, l) => s + l.kcal, 0),
    protein: logs.reduce((s, l) => s + l.protein_g, 0),
    carbs: logs.reduce((s, l) => s + l.carbs_g, 0),
    fat: logs.reduce((s, l) => s + l.fat_g, 0),
  }), [logs])

  const deleteLog = async (id: string) => {
    if (deletingId) return
    setDeletingId(id)
    try {
      const res = await fetch('/api/logs/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Delete failed')
      const { start } = getUtcDayRange(new Date())
      queryClient.setQueryData<FoodLog[]>(['food-logs', user?.id, start], (old = []) => old.filter(f => f.id !== id))
      toast({ title: 'Entry deleted', duration: 2000 })
    } catch (err) {
      toast({ title: 'Delete failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  if (logs.length === 0) return null

  return (
    <div className="space-y-2">
      {/* Summary row */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Today&apos;s log</p>
        <div className="flex gap-3 text-[11px]">
          <span className="font-bold text-foreground">{Math.round(totals.kcal)} kcal</span>
          <span className="text-blue-500 dark:text-blue-400">P{Math.round(totals.protein)}g</span>
          <span className="text-amber-500 dark:text-amber-400">C{Math.round(totals.carbs)}g</span>
          <span className="text-rose-500 dark:text-rose-400">F{Math.round(totals.fat)}g</span>
        </div>
      </div>
      {byMeal.map(({ meal, logs: mealLogs }) => (
        <MealGroup
          key={meal}
          meal={meal}
          logs={mealLogs}
          onDelete={deleteLog}
          deletingId={deletingId}
          onEdit={setEditingLog}
        />
      ))}

      {editingLog && (
        <EditFoodLogModal
          log={editingLog}
          onClose={() => setEditingLog(null)}
        />
      )}
    </div>
  )
}
