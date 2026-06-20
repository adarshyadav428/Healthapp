'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function getWeekDays(mondayKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(new Date(mondayKey + 'T00:00:00Z').getTime() + i * 86_400_000)
    return d.toISOString().slice(0, 10)
  })
}

interface DeficitData {
  tdee: number
  eat_target: number
  actual_daily_deficit: number
  actual_weekly_target: number
  implied_pace_kg: number
  target_weight_kg: number | null
  today: string
  week_start: string
  days: { date: string; calories: number }[]
}

export function WeeklyDeficitCard() {
  const { data, isLoading } = useQuery<DeficitData>({
    queryKey: ['weekly-deficit'],
    queryFn: () => fetch('/api/deficit/weekly').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const weekDays = useMemo(() => data ? getWeekDays(data.week_start) : [], [data])

  // Sum up this week's actual deficit from logged days only
  const { weeklyDeficitSoFar, daysLogged } = useMemo(() => {
    if (!data) return { weeklyDeficitSoFar: 0, daysLogged: 0 }
    let total = 0
    let count = 0
    for (const date of weekDays) {
      if (date > data.today) continue
      const log = data.days.find(d => d.date === date)
      if (log) {
        total += data.tdee - log.calories
        count++
      }
    }
    return { weeklyDeficitSoFar: total, daysLogged: count }
  }, [data, weekDays])

  if (isLoading) {
    return <div className="h-44 rounded-3xl bg-card border border-border animate-pulse" />
  }
  if (!data) return null

  const weeklyTarget = data.actual_weekly_target
  const progressPct  = weeklyTarget > 0
    ? Math.min(100, Math.max(0, (weeklyDeficitSoFar / weeklyTarget) * 100))
    : 0
  const isSurplus    = weeklyDeficitSoFar < 0

  const progressColor = isSurplus
    ? 'bg-rose-400'
    : progressPct >= 100
    ? 'bg-emerald-400'
    : 'bg-orange-400'

  const maxBarH = Math.max(
    data.actual_daily_deficit * 1.5,
    300,
    ...data.days.map(d => Math.abs(data.tdee - d.calories))
  )

  return (
    <div className="rounded-3xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">

      {/* ── Section 1: What to eat ── */}
      <div className="p-4 border-b border-gray-50 dark:border-slate-800">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Calorie plan</p>

        <div className="flex gap-3">
          {/* Eat target — the only number that matters */}
          <div className="flex-1 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/50 px-4 py-3 flex flex-col justify-center">
            <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-semibold mb-0.5">Eat daily</p>
            <p className="text-[28px] font-black text-indigo-700 dark:text-indigo-300 leading-none tabular-nums">
              {data.eat_target.toLocaleString()}
            </p>
            <p className="text-[10px] text-indigo-400 mt-0.5">kcal / day</p>
          </div>

          {/* Maintenance + goal weight stacked */}
          <div className="flex flex-col gap-2 w-[42%]">
            <div className="flex-1 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-3 py-2">
              <p className="text-[9px] font-semibold text-muted uppercase tracking-wide">Maintenance</p>
              <p className="text-sm font-black text-foreground">{data.tdee.toLocaleString()} <span className="text-[10px] font-normal text-muted">kcal</span></p>
            </div>
            <div className="flex-1 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-3 py-2">
              <p className="text-[9px] font-semibold text-muted uppercase tracking-wide">Goal weight</p>
              <p className="text-sm font-black text-foreground">
                {data.target_weight_kg ? `${data.target_weight_kg} kg` : '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Deficit summary line + settings link */}
        <div className="mt-2.5 flex items-center justify-between">
          <p className="text-[11px] text-muted">
            <span className="font-semibold text-foreground">{data.actual_daily_deficit.toLocaleString()} kcal</span> deficit/day
            {data.implied_pace_kg > 0 && (
              <> · lose <span className="font-semibold text-foreground">~{data.implied_pace_kg} kg</span>/week</>
            )}
          </p>
          <Link href="/settings" className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400">
            Edit →
          </Link>
        </div>
      </div>

      {/* ── Section 2: This week ── */}
      <div className="p-4">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">This week</p>
          {daysLogged > 0 && (
            <p className={`text-xs font-black ${isSurplus ? 'text-rose-500' : progressPct >= 100 ? 'text-emerald-500' : 'text-orange-500'}`}>
              {isSurplus ? 'Surplus' : `${Math.round(progressPct)}% of goal`}
            </p>
          )}
        </div>

        {/* Numbers */}
        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="text-2xl font-black text-foreground tabular-nums leading-none">
            {daysLogged > 0 ? weeklyDeficitSoFar.toLocaleString() : '—'}
          </span>
          {weeklyTarget > 0 && (
            <span className="text-xs text-muted">/ {weeklyTarget.toLocaleString()} kcal target</span>
          )}
        </div>

        {/* Progress bar */}
        {weeklyTarget > 0 && (
          <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-700 ${progressColor}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        {/* 7-day bars */}
        <div className="flex items-end gap-1.5 h-10">
          {weekDays.map((date, i) => {
            const log      = data.days.find(d => d.date === date)
            const isToday  = date === data.today
            const isFuture = date > data.today
            const deficit  = log ? data.tdee - log.calories : 0
            const barH     = log ? Math.max(8, Math.round((Math.abs(deficit) / maxBarH) * 100)) : 0
            const green    = deficit >= 0

            return (
              <div key={date} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex flex-col justify-end h-7">
                  {!isFuture && log ? (
                    <div
                      style={{ height: `${barH}%` }}
                      className={`w-full rounded-t-sm transition-all duration-500 ${green ? 'bg-emerald-400 dark:bg-emerald-500' : 'bg-rose-400 dark:bg-rose-500'}`}
                    />
                  ) : (
                    <div className={`w-full h-0.5 rounded-full ${isFuture ? 'bg-gray-100 dark:bg-slate-800' : 'bg-gray-200 dark:bg-slate-700'}`} />
                  )}
                </div>
                <p className={`text-[9px] font-bold leading-none ${isToday ? 'text-orange-500' : 'text-muted'}`}>
                  {DAY_LABELS[i]}
                </p>
                {isToday && <div className="h-0.5 w-3 rounded-full bg-orange-400" />}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-2">
          <p className="text-[11px] text-muted">
            {daysLogged > 0 ? `${daysLogged}/7 days logged` : 'No logs this week yet'}
          </p>
          <Link href="/deficit" className="flex items-center gap-0.5 text-[11px] font-semibold text-indigo-500 dark:text-indigo-400">
            Details <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

    </div>
  )
}
