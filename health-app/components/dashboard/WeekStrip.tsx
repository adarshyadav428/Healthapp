'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { buildWeekStrip } from '../../lib/weekStrip'
import { cn } from '../../lib/utils'

/**
 * Last-7-days strip on the home screen: tap any day to jump straight to that
 * day's diary (/log?date=…). Today is the ink-filled chip; an ember dot marks
 * days with at least one food log (accent reserved for data). The 7-day window
 * mirrors the free-tier history limit, so no chip here can hit the upgrade
 * redirect. Days come from buildWeekStrip, which keys them by IST calendar day
 * to match /log and the server's loggedDates.
 */
export function WeekStrip({ loggedDates }: { loggedDates: string[] }) {
  const days = useMemo(() => buildWeekStrip(loggedDates), [loggedDates])

  return (
    <nav aria-label="Last 7 days" className="mt-5 flex justify-between gap-1.5">
      {days.map((d) => (
        <Link
          key={d.key}
          href={d.isToday ? '/log' : `/log?date=${d.key}`}
          aria-label={`Open diary for ${d.key}`}
          aria-current={d.isToday ? 'date' : undefined}
          className={cn(
            'flex h-14 flex-1 flex-col items-center justify-center rounded-control tap-scale transition-colors',
            d.isToday
              ? 'bg-ink text-canvas'
              : 'border border-hairline bg-surface text-ink shadow-air hover:bg-surface-2'
          )}
        >
          <span className={cn('text-micro font-semibold', d.isToday ? 'text-canvas' : 'text-ink-3')}>
            {d.letter}
          </span>
          <span className="text-caption font-semibold tabular-nums leading-none">{d.dayNum}</span>
          <span
            aria-hidden="true"
            className={cn('mt-1 h-1 w-1 rounded-full', d.hasLog ? 'bg-brand' : 'bg-transparent')}
          />
        </Link>
      ))}
    </nav>
  )
}
