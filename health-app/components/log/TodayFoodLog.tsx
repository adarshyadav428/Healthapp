'use client'

import { useMemo, useState } from 'react'
import type { FoodLog } from '../../types/index'
import { useFoodLogs } from '../../hooks/useFoodLogs'
import { useUser } from '../../hooks/useUser'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../ui/use-toast'
import { getIstDayRange, istDateStr } from '../../lib/dateUtils'
import { isLiquidFood } from '../../lib/portion-units'
import { Trash2, BookmarkPlus, Check, X, ClipboardCopy } from 'lucide-react'
import { EditFoodLogModal } from './EditFoodLogModal'
import { ShareDayButton } from './ShareDayButton'
import { EmojiTile } from './shortcuts'
import { cn } from '../../lib/utils'
import { firstNameFrom } from '../../lib/shareCard'
import { MEAL_CLIPBOARD_KEY, serializeMealClipboard } from '../../lib/mealClipboard'
import type { Meal } from '../../lib/meal'

// `swatch` is the small square beside the meal name — the four macro/brand
// hues, so the day's shape is readable at a glance without a legend.
const MEAL_CONFIG: Record<string, { label: string; emoji: string; swatch: string }> = {
  breakfast: { label: 'Breakfast', emoji: '🥣', swatch: 'var(--brand)' },
  lunch:     { label: 'Lunch',     emoji: '🍛', swatch: 'var(--protein)' },
  dinner:    { label: 'Dinner',    emoji: '🍲', swatch: 'var(--fat)' },
  snack:     { label: 'Snacks',    emoji: '🥜', swatch: 'var(--carbs)' },
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
  const [saving, setSaving] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [mealName, setMealName] = useState('')
  const [copied, setCopied] = useState(false)
  const cfg = MEAL_CONFIG[meal] ?? { label: meal, emoji: '🍽️', swatch: 'var(--ink-3)' }
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
      toast({ title: `"${name}" saved`, description: 'Find it under My foods, one tap to log.', duration: 3000 })
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

  const iconAction =
    'grid h-9 w-9 place-items-center rounded-full text-ink-3 tap-scale transition-colors hover:bg-surface-2 hover:text-ink'

  return (
    <section aria-label={cfg.label} className="pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-caption font-semibold text-ink-2">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: cfg.swatch }} />
          {cfg.label}
        </h3>
        <div className="flex items-center gap-1">
          <span className="mr-1 text-caption tabular-nums text-ink-3">{Math.round(totalKcal).toLocaleString('en-IN')} kcal</span>
          {/* Copy to another day / keep as a combo — icon targets on the header
              row, so the group's rows stay just food. */}
          {!savingName && (
            <>
              <button type="button" onClick={copyMeal} aria-label={copied ? `${cfg.label} copied` : `Copy ${cfg.label.toLowerCase()} to another day`} className={iconAction}>
                {copied
                  ? <Check className="h-4 w-4 text-good" strokeWidth={2} />
                  : <ClipboardCopy className="h-4 w-4" strokeWidth={1.75} />}
              </button>
              <button type="button" onClick={() => setSavingName(true)} aria-label={`Save ${cfg.label.toLowerCase()} as a combo`} className={cn(iconAction, '-mr-2')}>
                <BookmarkPlus className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
      </div>

      <ul className="mt-1 divide-y divide-hairline">
        {logs.map((log) => {
          const name = log.food?.name ?? (log.food_id == null ? 'Quick add' : 'Food item')
          const amount = log.food_id == null
            ? null
            : `${Math.round(log.grams)} ${isLiquidFood(name) ? 'ml' : 'g'}`
          return (
            <li key={log.id} className="flex items-center gap-1 py-2">
              <button
                type="button"
                onClick={() => onEdit(log)}
                aria-label={`Edit ${name}`}
                className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control text-left tap-scale"
              >
                <EmojiTile name={name} className="h-9 w-9 rounded-lg" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-body font-medium leading-snug text-ink">{name}</span>
                  <span className="mt-0.5 block truncate text-caption tabular-nums text-ink-3">
                    {amount ? `${amount} · ` : ''}
                    P{Math.round(log.protein_g)} C{Math.round(log.carbs_g)} F{Math.round(log.fat_g)}
                  </span>
                </span>
                <span className="shrink-0 text-body font-semibold tabular-nums text-ink">{Math.round(log.kcal)}</span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(log.id)}
                disabled={deletingId === log.id}
                aria-label={`Delete ${name}`}
                className="-mr-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-3 tap-scale transition-colors hover:bg-surface-2 hover:text-danger disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </li>
          )
        })}
      </ul>

      {/* Naming a combo — inline, replaces nothing but itself */}
      {savingName && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={mealName}
            onChange={(e) => setMealName(e.target.value)}
            placeholder={`Name it (e.g. "${cfg.label} usual")`}
            className="h-11 flex-1 rounded-control border border-hairline bg-surface-2 px-3 text-base text-ink outline-none transition-[border-color,box-shadow] placeholder:text-ink-3 focus:border-brand focus:bg-surface focus:ring-[3px] focus:ring-brand-ring"
            onKeyDown={(e) => e.key === 'Enter' && saveMeal()}
            autoFocus
          />
          <button
            type="button"
            onClick={saveMeal}
            disabled={saving}
            aria-label="Save meal name"
            className="grid h-11 w-11 place-items-center rounded-full bg-brand text-white tap-scale disabled:opacity-40"
          >
            <Check className="h-5 w-5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => setSavingName(false)}
            aria-label="Cancel"
            className="grid h-11 w-11 place-items-center rounded-full text-ink-3 tap-scale hover:bg-surface-2"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
      )}
    </section>
  )
}

/**
 * The day's log, grouped by meal. Live via useFoodLogs, so a "+" anywhere on
 * the Food screen shows up here without a reload. The header carries the day's
 * eaten / target total — the summary card that used to sit above the search
 * answered the same question and is gone.
 */
export function TodayFoodLog(
  { initialLogs, date = new Date(), displayName, kcalTarget = 0 }:
  { initialLogs: FoodLog[]; date?: Date; displayName?: string | null; kcalTarget?: number }
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

  const isToday = getIstDayRange(date).start === getIstDayRange(new Date()).start
  const eaten = Math.round(totals.kcal)
  const over = eaten - kcalTarget
  const pct = kcalTarget > 0 ? Math.min((eaten / kcalTarget) * 100, 100) : 0

  return (
    <div className="rounded-card-lg border-2 border-hairline-2 bg-surface px-4 py-4 shadow-air">
      {/* ── Header: the day's total against its target. The log is the one
          surface on this screen: what you *ate* sits on white, what you
          *might* log sits on the canvas with a "+" — the two must never read
          as the same list. ── */}
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-title-sm font-semibold text-ink">{isToday ? "Today's log" : 'Log'}</h2>
        <p className="text-caption tabular-nums text-ink-3">
          <span className="text-body font-semibold text-ink">{eaten.toLocaleString('en-IN')}</span>
          {kcalTarget > 0 ? ` / ${kcalTarget.toLocaleString('en-IN')} kcal` : ' kcal'}
        </p>
      </div>
      {kcalTarget > 0 && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" role="presentation">
          <div className="h-full rounded-full bg-cta-grad transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
      )}
      {logs.length > 0 && (
        <div className="mt-2 flex items-baseline justify-between gap-3 text-caption tabular-nums text-ink-3">
          <p>P {Math.round(totals.protein)} g · C {Math.round(totals.carbs)} g · F {Math.round(totals.fat)} g</p>
          {kcalTarget > 0 && (
            <p className={over > 0 ? 'font-semibold text-brand-text' : 'font-semibold text-good'}>
              {over > 0 ? `${over.toLocaleString('en-IN')} over` : `${Math.abs(over).toLocaleString('en-IN')} left`}
            </p>
          )}
        </div>
      )}

      {logs.length === 0 ? (
        <p className="mt-3 text-caption text-ink-3">
          {isToday ? 'Nothing logged yet. Search above, or tap + on something you ate recently.' : 'Nothing was logged this day.'}
        </p>
      ) : (
        <>
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
        </>
      )}

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
