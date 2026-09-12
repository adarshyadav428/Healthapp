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

/**
 * Date caption over the "Food" title, with the day controls on the right.
 * Chrome casts no shadow: the chevrons are bare 44px targets and "Today" is a
 * quiet pill, so the search field below is the first thing with any weight.
 */
export function FoodHeader({ dateStr, prevDayLocked = false }: Props) {
  const router = useRouter()
  const todayStr = istDateStr()
  const isToday = dateStr === todayStr

  const go = (target: string) => router.push(logHref(target, todayStr))

  const chevron =
    'flex h-11 w-11 items-center justify-center rounded-full text-ink tap-scale transition-colors hover:bg-surface-2 disabled:opacity-40'

  return (
    <header className="flex items-end justify-between gap-4 pt-2">
      <div className="min-w-0">
        <p className="text-caption font-medium text-ink-3">{formatDisplay(dateStr)}</p>
        <h1 className="font-display mt-1 text-title font-semibold text-ink">Food</h1>
      </div>
      <nav aria-label="Change day" className="-mr-2 flex shrink-0 items-center">
        {!isToday && (
          <button
            type="button"
            onClick={() => go(todayStr)}
            className="mr-1 flex h-9 items-center rounded-full border border-hairline bg-surface px-3.5 text-caption font-semibold text-ink tap-scale"
          >
            Today
          </button>
        )}
        {prevDayLocked ? (
          <Link
            href="/upgrade?reason=history"
            aria-label="Older days are a Pro feature — upgrade to Pro"
            className={`relative ${chevron} text-ink-3`}
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
            <Lock className="absolute bottom-2 right-2 h-3 w-3 text-brand-text" strokeWidth={2.5} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => go(shiftDateStr(dateStr, -1))}
            aria-label="Previous day"
            className={chevron}
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
          </button>
        )}
        <button
          type="button"
          onClick={() => !isToday && go(shiftDateStr(dateStr, 1))}
          disabled={isToday}
          aria-label="Next day"
          className={chevron}
        >
          <ChevronRight className="h-6 w-6" strokeWidth={1.75} />
        </button>
      </nav>
    </header>
  )
}
