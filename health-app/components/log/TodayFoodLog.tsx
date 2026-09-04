'use client'

import { useMemo, useState } from 'react'
import type { FoodLog } from '../../types/index'
import { useFoodLogs } from '../../hooks/useFoodLogs'
import { useUser } from '../../hooks/useUser'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../ui/use-toast'
import { getIstDayRange, istDateStr } from '../../lib/dateUtils'
import { Trash2, ChevronDown, Pencil, BookmarkPlus, Check, X, ClipboardCopy } from 'lucide-react'
import { IconButton } from '../ui/IconButton'
import { EditFoodLogModal } from './EditFoodLogModal'
import { ShareDayButton } from './ShareDayButton'
import { firstNameFrom } from '../../lib/shareCard'
import { MEAL_CLIPBOARD_KEY, serializeMealClipboard } from '../../lib/mealClipboard'
import type { Meal } from '../../lib/meal'

const MEAL_CONFIG: Record<string, { label: string; emoji: string; dot: string }> = {
  breakfast: { label: 'Breakfast', emoji: '🥣', dot: 'var(--brand)' },
  lunch:     { label: 'Lunch',     emoji: '🍛', dot: 'var(--protein)' },
  dinner:    { label: 'Dinner',    emoji: '🍲', dot: 'var(--fat)' },
  snack:     { label: 'Snacks',    emoji: '🥜', dot: 'var(--carbs)' },
}

function MealGroup({ meal, logs, dateStr, onDelete, deletingId, onEdit }: {
  meal: string
  logs: FoodLog[]
  /** The IST day these logs belong to — what the clipboard copies FROM. */
  dateStr: string
  onDelete: (id: string) => void
  deletingId: string | null
  onEdit: (log: FoodLog) => void
}) {
  const [open, setOpen] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [mealName, setMealName] = useState('')
  const [copied, setCopied] = useState(false)
  const cfg = MEAL_CONFIG[meal] ?? { label: meal, emoji: '🍽️', dot: 'var(--ink-3)' }
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

  // Copy stores a *reference* to this meal (day + slot), not its rows — the
  // paste re-reads them server-side. See lib/mealClipboard.ts for why.
  const copyMeal = () => {
    try {
      window.localStorage.setItem(
        MEAL_CLIPBOARD_KEY,
        serializeMealClipboard({
          date: dateStr,
          meal: meal as Meal,
          label: cfg.label,
          emoji: cfg.emoji,
          items: logs.length,
          kcal: Math.round(totalKcal),
          copiedAt: Date.now(),
        })
      )
    } catch {
      toast({ title: 'Could not copy', description: 'Storage is unavailable in this browser.', variant: 'error' })
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({
      title: `${cfg.label} copied`,
      description: 'Open another day and tap Paste above the log.',
      duration: 4000,
    })
  }

  return (
    <div className="rounded-card overflow-hidden bg-surface shadow-rest">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
          <span className="text-sm">{cfg.emoji}</span>
          <span className="text-[13px] font-semibold text-ink">{cfg.label}</span>
          <span className="text-[12px] text-ink-3">· {logs.length} item{logs.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-ink-3 tabular-nums">{Math.round(totalKcal)} kcal</span>
          <ChevronDown
            className="h-3.5 w-3.5 text-ink-3 transition-transform"
            style={{ transform: open ? 'rotate(180deg)' : 'none' }}
          />
        </div>
      </button>

      {open && (
        <div className="px-3 pb-2 space-y-1.5 pt-1.5 border-t border-hairline">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between rounded-control px-3 py-2 bg-surface-2">
              <div className="min-w-0 flex-1 mr-2">
                <p className="text-xs font-medium truncate text-ink">
                  {log.food?.name ?? (log.food_id == null ? 'Quick Add' : 'Food item')}
                </p>
                <div className="flex gap-2 mt-0.5 flex-wrap tabular-nums">
                  <span className="text-[10px] font-semibold text-ink">{Math.round(log.kcal)} kcal</span>
                  <span className="text-[10px] font-medium" style={{ color: 'var(--protein)' }}>P{Math.round(log.protein_g)}g</span>
                  <span className="text-[10px] font-medium" style={{ color: 'var(--carbs)' }}>C{Math.round(log.carbs_g)}g</span>
                  <span className="text-[10px] font-medium" style={{ color: 'var(--fat)' }}>F{Math.round(log.fat_g)}g</span>
                  {log.food?.fiber_g_per_100g != null && log.food.fiber_g_per_100g > 0 && (
                    <span className="text-[10px] font-medium text-good">
                      Fi{Math.round(log.food.fiber_g_per_100g * log.grams / 100)}g
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <IconButton
                  onClick={() => onEdit(log)}
                  className="text-ink-3 hover:text-brand"
                  label="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                </IconButton>
                <IconButton
                  onClick={() => onDelete(log.id)}
                  disabled={deletingId === log.id}
                  className="text-ink-3 hover:text-danger disabled:opacity-40"
                  label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                </IconButton>
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
                className="flex-1 rounded-control px-3 py-1.5 text-base text-ink outline-none transition-all bg-surface-2 border border-hairline focus:border-brand"
                onKeyDown={(e) => e.key === 'Enter' && saveMeal()}
                autoFocus
              />
              <button
                type="button"
                onClick={saveMeal}
                disabled={saving}
                aria-label="Save meal name"
                className="grid h-9 w-9 place-items-center rounded-control text-white disabled:opacity-50 transition-colors bg-brand"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSavingName(false)}
                aria-label="Cancel"
                className="grid h-9 w-9 place-items-center rounded-control text-ink-3 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={copyMeal}
                className="flex flex-1 items-center gap-1.5 rounded-control px-3 py-1.5 text-[11px] font-semibold text-ink-3 transition-colors"
              >
                {copied
                  ? <Check className="h-3.5 w-3.5 text-good" strokeWidth={2} />
                  : <ClipboardCopy className="h-3.5 w-3.5" strokeWidth={1.75} />}
                {copied ? 'Copied' : `Copy ${cfg.label.toLowerCase()}`}
              </button>
              <button
                type="button"
                onClick={() => setSavingName(true)}
                className="flex flex-1 items-center gap-1.5 rounded-control px-3 py-1.5 text-[11px] font-semibold text-ink-3 transition-colors"
              >
                <BookmarkPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
                Save as meal template
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function TodayFoodLog(
  { initialLogs, date = new Date(), displayName }:
  { initialLogs: FoodLog[]; date?: Date; displayName?: string | null }
) {
  const { user } = useUser()
  const queryClient = useQueryClient()
  const { data: logs = initialLogs } = useFoodLogs(user?.id ?? null, date, initialLogs)
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

  // Delete is one tap with no confirmation, so undo is the safety net. It
  // re-inserts rather than resurrecting the original row — a new id for the
  // same meal is indistinguishable to the user — and passes `restore` so the
  // re-insert doesn't count as a new log in analytics or fire a milestone.
  const restoreLog = async (log: FoodLog) => {
    try {
      const loggedDate = istDateStr(new Date(log.logged_at))
      const res = log.food_id
        ? await fetch('/api/logs/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              food_id: log.food_id,
              meal: log.meal,
              servings: log.servings,
              grams: log.grams,
              date: loggedDate,
              restore: true,
            }),
          })
        : await fetch('/api/logs/quick-add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kcal: Math.round(log.kcal),
              protein: log.protein_g,
              carbs: log.carbs_g,
              fat: log.fat_g,
              meal: log.meal,
              date: loggedDate,
              restore: true,
            }),
          })
      const body = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) throw new Error(body.error ?? 'Could not restore')
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
    } catch (err) {
      toast({ title: 'Could not undo', description: (err as Error).message, variant: 'error' })
    }
  }

  const deleteLog = async (id: string) => {
    if (deletingId) return
    const deleted = logs.find((l) => l.id === id)
    setDeletingId(id)
    try {
      const res = await fetch('/api/logs/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Delete failed')
      const { start } = getIstDayRange(date)
      queryClient.setQueryData<FoodLog[]>(['food-logs', user?.id, start], (old = []) => old.filter(f => f.id !== id))
      toast({
        title: 'Entry deleted',
        duration: 5000,
        ...(deleted
          ? { action: { label: 'Undo', altText: 'Undo deleting this entry', onClick: () => { void restoreLog(deleted) } } }
          : {}),
      })
    } catch (err) {
      toast({ title: 'Delete failed', description: (err as Error).message, variant: 'error' })
    } finally {
      setDeletingId(null)
    }
  }

  if (logs.length === 0) return null

  const isToday = getIstDayRange(date).start === getIstDayRange(new Date()).start

  return (
    <div className="space-y-2">
      {/* Summary row */}
      <div className="flex items-center justify-between">
        <p className="text-[10.5px] font-medium uppercase tracking-[.1em] text-ink-3">{isToday ? "Today's log" : 'Log'}</p>
        <div className="flex gap-3 text-[11px] tabular-nums">
          <span className="font-semibold text-ink">{Math.round(totals.kcal)} kcal</span>
          <span className="font-medium" style={{ color: 'var(--protein)' }}>P{Math.round(totals.protein)}g</span>
          <span className="font-medium" style={{ color: 'var(--carbs)' }}>C{Math.round(totals.carbs)}g</span>
          <span className="font-medium" style={{ color: 'var(--fat)' }}>F{Math.round(totals.fat)}g</span>
        </div>
      </div>
      {byMeal.map(({ meal, logs: mealLogs }) => (
        <MealGroup
          key={meal}
          meal={meal}
          logs={mealLogs}
          dateStr={istDateStr(date)}
          onDelete={deleteLog}
          deletingId={deletingId}
          onEdit={setEditingLog}
        />
      ))}

      <ShareDayButton logs={logs} date={date} firstName={firstNameFrom(displayName)} />

      {editingLog && (
        <EditFoodLogModal
          log={editingLog}
          onClose={() => setEditingLog(null)}
          logDate={date}
        />
      )}
    </div>
  )
}
