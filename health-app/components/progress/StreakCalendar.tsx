'use client'

import { useMemo } from 'react'

type Props = {
  /** ISO timestamp strings for every food log entry in the last 60 days */
  loggedDates: string[]
}

export function StreakCalendar({ loggedDates }: Props) {
  const today = useMemo(() => {
    const d = new Date()
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  }, [])

  // Build a set of YYYY-MM-DD strings where user logged food
  const loggedSet = useMemo(() => {
    const set = new Set<string>()
    for (const ts of loggedDates) {
      const d = new Date(ts)
      set.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`)
    }
    return set
  }, [loggedDates])

  // Generate last 35 days (5 rows × 7 cols, most recent last)
  const cells = useMemo(() => {
    const arr: { dateStr: string; isToday: boolean; logged: boolean }[] = []
    for (let i = 34; i >= 0; i--) {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - i)
      const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
      arr.push({ dateStr, isToday: dateStr === today, logged: loggedSet.has(dateStr) })
    }
    return arr
  }, [loggedSet, today])

  const loggedCount = cells.filter((c) => c.logged).length
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  // Offset the first cell to align to the correct day-of-week
  const firstDay = new Date(cells[0].dateStr + 'T00:00:00Z').getUTCDay() // 0=Sun
  const paddedCells = [
    ...Array.from({ length: firstDay }, (_, i) => ({ dateStr: `pad-${i}`, isToday: false, logged: false, pad: true })),
    ...cells.map((c) => ({ ...c, pad: false })),
  ]

  return (
    <div className="rounded-card bg-surface border border-hairline p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-2">Logging habit · last 5 weeks</p>
        <span className="text-[11px] font-bold text-brand-ink tabular-nums">{loggedCount} / 35 days</span>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayLabels.map((l, i) => (
          <div key={i} className="text-center text-[9px] font-semibold text-ink-2">{l}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {paddedCells.map((cell, i) => {
          if (cell.pad) {
            return <div key={`pad-${i}`} />
          }
          return (
            <div
              key={cell.dateStr}
              title={cell.dateStr}
              className={[
                'aspect-square rounded-md transition-all',
                cell.isToday
                  ? cell.logged
                    ? 'bg-brand ring-2 ring-brand/30'
                    : 'bg-surface-2 ring-2 ring-brand'
                  : cell.logged
                  ? 'bg-brand'
                  : 'bg-surface-2',
              ].join(' ')}
            />
          )
        })}
      </div>

      <div className="flex items-center gap-3 mt-3">
        <div className="flex items-center gap-1 text-[10px] text-ink-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand inline-block" /> Logged
        </div>
        <div className="flex items-center gap-1 text-[10px] text-ink-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-surface-2 inline-block ring-1 ring-hairline" /> No log
        </div>
        <div className="flex items-center gap-1 text-[10px] text-ink-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-surface-2 inline-block ring-2 ring-brand" /> Today
        </div>
      </div>
    </div>
  )
}
