'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from '../ui/use-toast'
import { userFacingApiError } from '../../lib/apiError'
import { logMetaHeaders, markLogStart } from '../../lib/posthog/client'
import { reportLogMilestone } from '../../store/milestoneStore'
import type { LogMilestone } from '../../lib/logMilestones'
import { MealTile, ShortcutRow } from './shortcuts'
import {
  MEAL_CLIPBOARD_KEY,
  canPasteOn,
  clipboardSourceLabel,
  parseMealClipboard,
  type MealClipboard,
} from '../../lib/mealClipboard'

/**
 * The other half of "copy this meal": the paste affordance, shown on every
 * editable day except the one the meal was copied from.
 *
 * It renders above the day's log rather than inside it, because the day a user
 * wants to paste into is usually the empty one — and TodayFoodLog renders
 * nothing at all when the day has no logs. It borrows ShortcutRow so it reads
 * as one of the repeat-logging shortcuts, which is exactly what it is.
 */
export function PasteMealCard({ logDate }: { logDate: string }) {
  const [clip, setClip] = useState<MealClipboard | null>(null)
  const [pasting, setPasting] = useState(false)
  const queryClient = useQueryClient()

  // Read after mount, never during render: the server has no clipboard, so
  // seeding state from localStorage would hydrate a different tree than the
  // one the server sent. Re-runs on day change, which is a client navigation
  // that re-renders this component rather than remounting it.
  useEffect(() => {
    try {
      setClip(parseMealClipboard(window.localStorage.getItem(MEAL_CLIPBOARD_KEY)))
    } catch {
      setClip(null)
    }
  }, [logDate])

  const clear = () => {
    try {
      window.localStorage.removeItem(MEAL_CLIPBOARD_KEY)
    } catch {
      /* private mode / storage disabled — the card still goes away */
    }
    setClip(null)
  }

  const paste = async (source: MealClipboard) => {
    if (pasting) return
    markLogStart()
    setPasting(true)
    try {
      const res = await fetch('/api/logs/copy-meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...logMetaHeaders('copy_meal') },
        body: JSON.stringify({ from_date: source.date, meal: source.meal, date: logDate }),
      })
      const body = (await res.json().catch(() => ({}))) as { copied?: number; error?: string; milestone?: LogMilestone }
      if (!res.ok) {
        // The source meal is gone — the clipboard points at nothing, so drop it
        // rather than leaving a button that can only fail again.
        if (res.status === 404) clear()
        throw new Error(userFacingApiError(res.status, body.error, 'Could not paste that meal.'))
      }
      queryClient.invalidateQueries({ queryKey: ['food-logs'] })
      const n = body.copied ?? source.items
      toast({
        title: `${source.label} pasted`,
        description: `${n} item${n === 1 ? '' : 's'} added to this day.`,
        duration: 3000,
      })
      reportLogMilestone(body.milestone)
    } catch (err) {
      toast({ title: 'Could not paste', description: (err as Error).message, variant: 'error' })
    } finally {
      setPasting(false)
    }
  }

  if (!clip || !canPasteOn(clip, logDate)) return null

  return (
    <ShortcutRow
      name={`Paste ${clip.label}`}
      detail={
        <span className="tabular-nums">
          {clip.items} item{clip.items === 1 ? '' : 's'} · {clip.kcal.toLocaleString('en-IN')} kcal from{' '}
          {clipboardSourceLabel(clip.date)}
        </span>
      }
      tile={<MealTile emoji={clip.emoji} />}
      busy={pasting}
      disabled={pasting}
      actionLabel={`Paste ${clip.label} onto this day`}
      onAdd={() => void paste(clip)}
      onDelete={clear}
      deleteLabel="Clear copied meal"
    />
  )
}
