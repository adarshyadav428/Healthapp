'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import { logHref, shiftDateStr } from '../../lib/logDates'
import { istDateStr } from '../../lib/dateUtils'

type Props = {
  dateStr: string /* YYYY-MM-DD in IST */
  /** Free user at the edge of the history window — the back chevron becomes a
   *  lock instead of teleporting them to the paywall with no warning. */
  prevDayLocked?: boolean
}

function formatDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const d = new Date(Date.UTC(year, month - 1, day))
  const yStr = shiftDateStr(istDateStr(), -1)
  if (dateStr === yStr) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

export function FoodHeader({ dateStr, prevDayLocked = false }: Props) {
  const router = useRouter()
  const todayStr = istDateStr()
  const isToday = dateStr === todayStr

  const go = (target: string) => router.push(logHref(target, todayStr))

  return (
    <div className="flex items-center justify-between pt-2">
      <div>
        <p className="text-[13px] font-medium text-ink-3">{formatDisplay(dateStr)}</p>
        <h1 className="font-display mt-[3px] text-[24px] font-bold tracking-[-0.02em] text-ink">Food</h1>
      </div>
      <div className="flex items-center gap-1">
        {!isToday && (
          <button
            type="button"
            onClick={() => go(todayStr)}
            className="tap-scale mr-1 flex h-9 items-center rounded-full bg-surface px-3.5 text-[12.5px] font-semibold text-ink"
            style={{ boxShadow: 'var(--shadow-air)' }}
          >
            Today
          </button>
        )}
        {prevDayLocked ? (
          <Link
            href="/upgrade?reason=history"
            aria-label="Older days are a Pro feature — upgrade to Pro"
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-surface tap-scale"
            style={{ boxShadow: 'var(--shadow-air)' }}
          >
            <ChevronLeft className="h-[15px] w-[15px] text-ink-3" strokeWidth={2} />
            <Lock className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 text-brand-ink" strokeWidth={2.5} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => go(shiftDateStr(dateStr, -1))}
            aria-label="Previous day"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface tap-scale"
            style={{ boxShadow: 'var(--shadow-air)' }}
          >
            <ChevronLeft className="h-[15px] w-[15px] text-ink" strokeWidth={2} />
          </button>
        )}
        <button
          type="button"
          onClick={() => !isToday && go(shiftDateStr(dateStr, 1))}
          disabled={isToday}
          aria-label="Next day"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface tap-scale disabled:opacity-35"
          style={{ boxShadow: 'var(--shadow-air)' }}
        >
          <ChevronRight className="h-[15px] w-[15px] text-ink" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
