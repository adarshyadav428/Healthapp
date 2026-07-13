'use client'

import { useMemo, useState } from 'react'
import type { Profile, WeightLog } from '../../types/index'
import { Flame, Scale, ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  streak:      number
  weightLogs:  WeightLog[]
  weekLogs:    { kcal: number; logged_at: string }[]
  kcalTarget:  number | null
  profile:     Profile
  loggedDates: string[]
}

// IST calendar date (YYYY-MM-DD) for a timestamp — matches what the user sees.
function istDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}
function pad(n: number) { return String(n).padStart(2, '0') }

const AIR = { boxShadow: 'var(--shadow-air)' } as const

export function ProgressClient({ streak, weightLogs, weekLogs, loggedDates }: Props) {
  const currentWeight = weightLogs[0]?.weight_kg ?? null

  // ── 7-day calorie bars ──────────────────────────────────────────────────────
  const { bars, avg } = useMemo(() => {
    const istToday = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    const days: { key: string; total: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(`${istToday}T12:00:00Z`)
      d.setUTCDate(d.getUTCDate() - i)
      days.push({ key: d.toISOString().slice(0, 10), total: 0 })
    }
    const idx = new Map(days.map((d, i) => [d.key, i]))
    for (const l of weekLogs) {
      const i = idx.get(istDate(l.logged_at))
      if (i !== undefined) days[i].total += l.kcal
    }
    const max = Math.max(1, ...days.map((d) => d.total))
    const active = days.filter((d) => d.total > 0)
    const avg = active.length ? Math.round(active.reduce((s, d) => s + d.total, 0) / active.length) : 0
    const bars = days.map((d, i) => ({
      label: new Date(`${d.key}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'narrow' }),
      pct: d.total > 0 ? Math.max((d.total / max) * 100, 6) : 3,
      today: i === days.length - 1,
    }))
    return { bars, avg }
  }, [weekLogs])

  // ── Month calendar ──────────────────────────────────────────────────────────
  const loggedSet = useMemo(() => new Set(loggedDates.map(istDate)), [loggedDates])
  const istTodayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const [ty, tm, td] = istTodayStr.split('-').map(Number)

  // How far back navigation may go (earliest logged month within our window)
  const minOffset = useMemo(() => {
    if (loggedSet.size === 0) return 0
    let earliest = istTodayStr
    for (const d of loggedSet) if (d < earliest) earliest = d
    const [ey, em] = earliest.split('-').map(Number)
    return (ey - ty) * 12 + (em - tm)
  }, [loggedSet, istTodayStr, ty, tm])

  const [offset, setOffset] = useState(0)
  const viewYear = ty + Math.floor((tm - 1 + offset) / 12)
  const viewMonth = ((tm - 1 + offset) % 12 + 12) % 12 // 0-indexed
  const isCurrentMonth = offset === 0

  const cal = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay() // 0=Sun
    const cells: ({ day: number; logged: boolean } | null)[] = []
    for (let i = 0; i < firstWeekday; i++) cells.push(null)
    let logged = 0
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`
      const isLogged = loggedSet.has(key)
      if (isLogged) logged++
      cells.push({ day, logged: isLogged })
    }
    while (cells.length % 7 !== 0) cells.push(null)
    const elapsed = isCurrentMonth ? td : daysInMonth
    const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
      month: 'long', ...(viewYear !== ty ? { year: 'numeric' } : {}),
    })
    return { cells, logged, elapsed, monthLabel }
  }, [viewYear, viewMonth, isCurrentMonth, td, ty, loggedSet])

  return (
    <>
      {/* ── Header ── */}
      <div className="pt-2">
        <p className="text-[13px] font-medium text-ink-3">Last 7 days</p>
        <h1 className="font-display mt-[3px] text-[24px] font-bold tracking-[-0.02em] text-ink">Trends</h1>
      </div>

      {/* ── Stat cards ── */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-[24px] bg-surface p-5" style={AIR}>
          <Flame className="h-[18px] w-[18px] text-brand" strokeWidth={2} />
          <p className="font-display mt-3.5 text-[34px] font-bold leading-none tabular-nums text-ink" style={{ letterSpacing: '-0.03em' }}>{streak}</p>
          <p className="mt-[5px] text-[12px] text-ink-3">day streak</p>
        </div>
        <div className="rounded-[24px] bg-surface p-5" style={AIR}>
          <Scale className="h-[18px] w-[18px] text-ink" strokeWidth={2} />
          <p className="font-display mt-3.5 text-[34px] font-bold leading-none tabular-nums text-ink" style={{ letterSpacing: '-0.03em' }}>
            {currentWeight ?? '—'}
          </p>
          <p className="mt-[5px] text-[12px] text-ink-3">kg current</p>
        </div>
      </div>

      {/* ── Calories bar chart ── */}
      <div className="mt-3 rounded-[24px] bg-surface p-[22px]" style={AIR}>
        <div className="flex items-baseline justify-between">
          <p className="text-[15px] font-semibold text-ink">Calories</p>
          <p className="text-[12px] text-ink-3">avg <b className="font-bold tabular-nums text-ink">{avg.toLocaleString('en-IN')}</b></p>
        </div>
        <div className="mt-[18px] flex h-[120px] items-end gap-2.5">
          {bars.map((b, i) => (
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <div
                className={`w-full max-w-[26px] rounded-lg ${b.today ? 'bg-brand' : 'bg-surface-2'}`}
                style={{ height: `${b.pct}%` }}
              />
              <span className={`text-[10px] ${b.today ? 'font-bold text-ink' : 'text-ink-3'}`}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Month calendar ── */}
      <div className="mt-3 rounded-[24px] bg-surface p-[22px]" style={AIR}>
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold text-ink">{cal.monthLabel}</p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setOffset((o) => Math.max(minOffset, o - 1))}
              disabled={offset <= minOffset}
              aria-label="Previous month"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 tap-scale disabled:opacity-35"
            >
              <ChevronLeft className="h-[13px] w-[13px] text-ink-2" />
            </button>
            <button
              type="button"
              onClick={() => setOffset((o) => Math.min(0, o + 1))}
              disabled={offset >= 0}
              aria-label="Next month"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 tap-scale disabled:opacity-35"
            >
              <ChevronRight className="h-[13px] w-[13px] text-ink-2" />
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {cal.cells.map((c, i) => (
            c === null ? (
              <div key={i} className="aspect-square" />
            ) : c.logged ? (
              <div key={i} className="flex aspect-square items-center justify-center rounded-full bg-brand">
                <Flame className="h-3 w-3 text-white" strokeWidth={2} />
              </div>
            ) : (
              <div key={i} className="aspect-square rounded-full bg-surface-2" />
            )
          ))}
        </div>
        <p className="mt-4 text-[12px] text-ink-3">
          <b className="font-bold text-ink">{cal.logged} of {cal.elapsed}</b> days logged this month
        </p>
      </div>
    </>
  )
}
