'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { Plateau } from '../../lib/plateau'
import { plateauCopy } from '../../lib/plateau'
import { captureEvent } from '../../lib/posthog/client'

/**
 * The week-3-to-4 moment.
 *
 * Weight loss stalls for almost everyone around here, and until now the app
 * said nothing — so the user concluded it wasn't working and stopped. This is
 * the "here's what's actually happening" card.
 *
 * Every judgement lives in lib/plateau: whether there is a plateau, whether the
 * logs explain it, and the exact words for each case. This component decides
 * only whether the user has already read it this week.
 *
 * Dismissal is per ISO week, matching AdaptiveTargetCard. A plateau lasts weeks
 * by definition, and re-showing the same paragraph every morning would turn a
 * useful message into nagging — but it should come back if the stall persists,
 * because by then it means something new.
 */

/** One dismissal per ISO week, so declining doesn't mean declining forever. */
function weekKey(userId: string): string {
  const now = new Date()
  const jan1 = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
  const week = Math.floor((now.getTime() - jan1.getTime()) / (7 * 86400000))
  return `gis.plateauDismissed.${userId}.${now.getUTCFullYear()}w${week}`
}

export function PlateauCard({
  plateau,
  goal,
  userId,
}: {
  plateau: Plateau
  goal: 'lose' | 'gain' | 'maintain'
  userId: string
}) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(weekKey(userId)) === '1'
    } catch {
      return false // fail open — a blocked localStorage shouldn't hide the message
    }
  })

  const copy = plateauCopy(plateau, goal)
  if (!copy || dismissed) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(weekKey(userId), '1')
    } catch {
      /* fail open */
    }
    captureEvent('plateau_card_dismissed', { kind: plateau.kind })
  }

  return (
    <div
      className="mt-4 rounded-[20px] bg-surface p-4"
      style={{ boxShadow: 'var(--shadow-air)' }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold leading-snug text-ink">{copy.headline}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{copy.body}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 shrink-0 rounded-full p-1.5 text-ink-3 tap-scale"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
