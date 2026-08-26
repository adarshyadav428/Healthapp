'use client'

import { useMemo } from 'react'
import Link from 'next/link'

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** UTC date key — matches how /log parses its ?date= param (UTC day ranges). */
function utcKey(d: Date): string {
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * Last-7-days strip on the home screen: tap any day to jump straight to that
 * day's diary (/log?date=…). An ember dot marks days with at least one food
 * log (accent reserved for data per Ember Air); today is the ink-filled chip.
 * The 7-day window mirrors the free-tier history limit, so no chip here can
 * hit the upgrade redirect.
 */
export function WeekStrip({ loggedDates }: { loggedDates: string[] }) {
  const days = useMemo(() => {
    const logged = new Set(loggedDates)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86_400_000)
      const key = utcKey(d)
      return {
        key,
        letter: DAY_LETTERS[d.getUTCDay()],
        dayNum: d.getUTCDate(),
        isToday: i === 6,
        hasLog: logged.has(key),
      }
    })
  }, [loggedDates])

  return (
    <div className="mt-4 flex justify-between gap-1.5">
      {days.map((d) => (
        <Link
          key={d.key}
          href={d.isToday ? '/log' : `/log?date=${d.key}`}
          aria-label={`Open diary for ${d.key}`}
          className={`tap-scale flex h-[58px] flex-1 flex-col items-center justify-center rounded-[14px] ${
            d.isToday ? 'bg-ink' : 'bg-surface'
          }`}
          style={d.isToday ? undefined : { boxShadow: 'var(--shadow-air)' }}
        >
          <span className={`text-[10px] font-semibold ${d.isToday ? 'text-canvas' : 'text-ink-3'}`}>
            {d.letter}
          </span>
          <span
            className={`mt-[1px] text-[14px] font-semibold tabular-nums ${
              d.isToday ? 'text-canvas' : 'text-ink'
            }`}
          >
            {d.dayNum}
          </span>
          <span
            className={`mt-[3px] h-[4px] w-[4px] rounded-full ${
              d.hasLog ? 'bg-brand' : 'bg-transparent'
            }`}
          />
        </Link>
      ))}
    </div>
  )
}
