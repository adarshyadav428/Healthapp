'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import type { Profile } from '../../types/index'
import { format, parseISO, startOfDay, subDays, eachDayOfInterval, parse, isWithinInterval } from 'date-fns'
import { DayDiary } from './DayDiary'
import { useUser } from '../../hooks/useUser'
import { CalendarDays, X, Flame, Dumbbell, Lock, Crown } from 'lucide-react'
import Link from 'next/link'

// Defer recharts — saves ~95KB on initial /history load.
const HistoryBarChart = dynamic(() => import('./HistoryBarChart').then(m => m.HistoryBarChart), {
  ssr: false,
  loading: () => <div className="h-[180px] rounded-card bg-surface border border-hairline animate-pulse" />,
})

type LogRow = {
  logged_at: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  meal: string
}

type ExerciseRow = {
  logged_at: string
  activity: string
  duration_min: number
  calories: number
}

type DayData = {
  date: string
  label: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  logged: boolean
}

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
]

export function HistoryClient({ logs, profile, exerciseLogs = [], isPro = false }: { logs: LogRow[]; profile: Profile; exerciseLogs?: ExerciseRow[]; isPro?: boolean }) {
  const [range, setRange] = useState(14)
  const [metric, setMetric] = useState<'kcal' | 'protein' | 'carbs' | 'fat'>('kcal')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const { user } = useUser()
  const target = profile.daily_calorie_target

  const metricTargets: Record<string, number> = {
    kcal: profile.daily_calorie_target,
    protein: profile.protein_g_target,
    carbs: profile.carbs_g_target,
    fat: profile.fat_g_target,
  }

  const chartData: DayData[] = useMemo(() => {
    const today = startOfDay(new Date())
    const days = eachDayOfInterval({ start: subDays(today, range - 1), end: today })

    const byDay = new Map<string, { kcal: number; protein: number; carbs: number; fat: number }>()
    for (const log of logs) {
      const key = format(startOfDay(parseISO(log.logged_at)), 'yyyy-MM-dd')
      const existing = byDay.get(key) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      byDay.set(key, {
        kcal: existing.kcal + log.kcal,
        protein: existing.protein + log.protein_g,
        carbs: existing.carbs + log.carbs_g,
        fat: existing.fat + log.fat_g,
      })
    }

    return days.map((day) => {
      const key = format(day, 'yyyy-MM-dd')
      const data = byDay.get(key)
      const isToday = key === format(today, 'yyyy-MM-dd')
      return {
        date: key,
        label: range <= 7 ? format(day, 'EEE') : format(day, 'MMM d'),
        kcal: Math.round(data?.kcal ?? 0),
        protein: Math.round(data?.protein ?? 0),
        carbs: Math.round(data?.carbs ?? 0),
        fat: Math.round(data?.fat ?? 0),
        logged: !!data && !isToday,
      }
    })
  }, [logs, range])

  const loggedDays = chartData.filter((d) => d.kcal > 0)
  const avgKcal = loggedDays.length > 0 ? Math.round(loggedDays.reduce((s, d) => s + d.kcal, 0) / loggedDays.length) : 0
  const avgProtein = loggedDays.length > 0 ? Math.round(loggedDays.reduce((s, d) => s + d.protein, 0) / loggedDays.length) : 0
  const avgCarbs = loggedDays.length > 0 ? Math.round(loggedDays.reduce((s, d) => s + d.carbs, 0) / loggedDays.length) : 0
  // Calorie deficit/surplus vs goal (positive = deficit, negative = surplus)
  const avgDeficit = target > 0 && avgKcal > 0 ? target - avgKcal : null
  const avgFat = loggedDays.length > 0 ? Math.round(loggedDays.reduce((s, d) => s + d.fat, 0) / loggedDays.length) : 0

  const streakCount = useMemo(() => {
    const today = format(startOfDay(new Date()), 'yyyy-MM-dd')
    const loggedSet = new Set(logs.map((l) => format(startOfDay(parseISO(l.logged_at)), 'yyyy-MM-dd')))
    let streak = 0
    let current = new Date()
    // Check today first, if not logged start from yesterday
    if (!loggedSet.has(format(current, 'yyyy-MM-dd'))) {
      current = subDays(current, 1)
    }
    while (loggedSet.has(format(current, 'yyyy-MM-dd'))) {
      streak++
      current = subDays(current, 1)
    }
    void today
    return streak
  }, [logs])

  const metricConfig = {
    kcal: { color: '#F2A23A', label: 'Calories', unit: 'kcal' },
    protein: { color: '#3566C4', label: 'Protein', unit: 'g' },
    carbs: { color: '#C98A1B', label: 'Carbs', unit: 'g' },
    fat: { color: '#C7554B', label: 'Fat', unit: 'g' },
  }

  const cfg = metricConfig[metric]

  return (
    <div className="space-y-4">
      {/* Free-tier upgrade banner */}
      {!isPro && (
        <div className="rounded-card border border-hairline bg-energy-soft p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Lock className="h-4 w-4 text-energy-ink shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-energy-ink">Showing last 7 days</p>
              <p className="text-[11px] text-energy-ink opacity-80">Pro unlocks full history</p>
            </div>
          </div>
          <Link
            href="/upgrade?reason=history"
            className="shrink-0 flex items-center gap-1 rounded-full bg-brand hover:opacity-90 px-3 py-1.5 text-xs font-bold text-white transition-opacity"
          >
            <Crown className="h-3 w-3" />
            Upgrade
          </Link>
        </div>
      )}
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Avg daily calories"
          value={avgKcal > 0 ? `${avgKcal.toLocaleString()}` : '--'}
          unit="kcal"
          sub={target > 0 && avgKcal > 0 ? `Goal: ${target.toLocaleString()}` : undefined}
          color="text-energy-ink"
          bg="bg-energy-soft border-hairline"
        />
        <StatCard
          label="Days logged"
          value={String(loggedDays.length)}
          unit={`of ${range}`}
          sub={streakCount > 0 ? `🔥 ${streakCount} day streak` : undefined}
          color="text-good"
          bg="bg-brand-soft border-hairline"
        />
      </div>
      {avgDeficit !== null && (
        <div className="rounded-card border border-hairline px-4 py-3 flex items-center justify-between"
          style={{ background: avgDeficit > 0 ? 'rgba(46,125,79,0.08)' : 'var(--bad-soft)' }}>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-2">Avg daily {avgDeficit >= 0 ? 'deficit' : 'surplus'}</p>
            <p className="text-xl font-bold mt-0.5 tabular-nums" style={{ color: avgDeficit >= 0 ? 'var(--good)' : 'var(--bad)' }}>
              {avgDeficit >= 0 ? '-' : '+'}{Math.abs(avgDeficit).toLocaleString()} kcal
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-ink-2">Est. weight {avgDeficit >= 0 ? 'loss' : 'gain'}</p>
            <p className="text-sm font-bold tabular-nums" style={{ color: avgDeficit >= 0 ? 'var(--good)' : 'var(--bad)' }}>
              {Math.abs(avgDeficit * loggedDays.length / 7700).toFixed(2)} kg / {range} days
            </p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <MacroCard label="Avg protein" value={avgProtein} unit="g" color="var(--protein)" />
        <MacroCard label="Avg carbs" value={avgCarbs} unit="g" color="var(--carbs)" />
        <MacroCard label="Avg fat" value={avgFat} unit="g" color="var(--fat)" />
      </div>

      {/* Exercise summary */}
      {exerciseLogs.length > 0 && (
        <ExerciseSection exerciseLogs={exerciseLogs} range={range} />
      )}

      {/* Chart card */}
      <div className="rounded-sheet border border-hairline bg-surface p-4 shadow-rest">
        {/* Range tabs */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">{cfg.label} trend</p>
          <div className="flex gap-1 rounded-control bg-surface-2 p-0.5">
            {RANGES.map((r) => {
              const locked = !isPro && r.days > 7
              return locked ? (
                <Link
                  key={r.days}
                  href="/upgrade?reason=history"
                  className="rounded-[0.625rem] px-2.5 py-1 text-xs font-semibold text-ink-2 flex items-center gap-1 opacity-60 hover:opacity-80 transition-opacity"
                >
                  <Lock className="h-3 w-3" />
                  {r.label}
                </Link>
              ) : (
                <button
                  key={r.days}
                  type="button"
                  onClick={() => setRange(r.days)}
                  className={`rounded-[0.625rem] px-2.5 py-1 text-xs font-semibold transition-all ${
                    range === r.days ? 'bg-surface text-ink shadow-rest' : 'text-ink-2'
                  }`}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Metric tabs */}
        <div className="flex gap-1.5 mb-4">
          {(Object.keys(metricConfig) as Array<keyof typeof metricConfig>).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`rounded-control px-3 py-1 text-xs font-semibold transition-all ${
                metric === m
                  ? 'text-white shadow-rest'
                  : 'bg-surface-2 text-ink-2 hover:bg-hairline/40'
              }`}
              style={metric === m ? { backgroundColor: metricConfig[m].color } : {}}
            >
              {metricConfig[m].label}
            </button>
          ))}
        </div>

        {/* Bar chart (recharts lazy-loaded) */}
        <HistoryBarChart
          chartData={chartData}
          range={range}
          metric={metric}
          metricTarget={metricTargets[metric]}
          color={cfg.color}
          unit={cfg.unit}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
        />

        <p className="mt-2 text-[10px] text-ink-2 text-center">
          Tap a bar to view that day&apos;s food diary
        </p>
      </div>

      {/* Day diary panel */}
      {selectedDate && user && (
        <div className="rounded-sheet border border-hairline bg-surface p-4 shadow-rest">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-brand" />
              <p className="text-sm font-bold text-ink">
                {format(parse(selectedDate, 'yyyy-MM-dd', new Date()), 'EEEE, MMM d')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="rounded-full p-1 hover:bg-surface-2 transition-colors"
            >
              <X className="h-4 w-4 text-ink-2" />
            </button>
          </div>
          <DayDiary
            userId={user.id}
            date={parse(selectedDate, 'yyyy-MM-dd', new Date())}
          />
        </div>
      )}

      {/* Weekly breakdown */}
      {loggedDays.length > 0 && (
        <div className="rounded-sheet border border-hairline bg-surface p-4 shadow-rest">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-2 mb-3">Calorie breakdown by day</p>
          <div className="space-y-2">
            {[...chartData].reverse().slice(0, 7).map((day) => {
              const pct = target > 0 ? Math.min((day.kcal / target) * 100, 100) : 0
              const barColor = day.kcal === 0 ? 'var(--hairline)' : day.kcal > target * 1.1 ? 'var(--bad)' : day.kcal >= target * 0.9 ? 'var(--good)' : 'var(--energy)'
              const isSelected = selectedDate === day.date
            return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(isSelected ? null : day.date)}
                  className={`flex items-center gap-3 w-full rounded-control px-2 py-1 -mx-2 transition-colors ${isSelected ? 'bg-brand-soft' : 'hover:bg-surface-2'}`}
                >
                  <span className={`w-14 text-xs font-medium shrink-0 ${isSelected ? 'text-brand-ink font-bold' : 'text-ink-2'}`}>{day.label}</span>
                  <div className="flex-1 h-5 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: day.kcal === 0 ? '0%' : `${pct}%`, background: isSelected ? 'var(--brand)' : barColor }}
                    />
                  </div>
                  <span className={`w-16 text-xs font-bold text-right shrink-0 tabular-nums ${isSelected ? 'text-brand-ink' : 'text-ink'}`}>
                    {day.kcal > 0 ? `${day.kcal.toLocaleString()} kcal` : '—'}
                  </span>
                </button>
              )
            })}
          </div>
          {target > 0 && (
            <div className="mt-3 flex items-center gap-3 text-[10px] text-ink-2">
              <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-good inline-block" /> On target</div>
              <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-energy inline-block" /> Under target</div>
              <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-danger inline-block" /> Over target</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ExerciseSection({ exerciseLogs, range }: { exerciseLogs: ExerciseRow[]; range: number }) {
  const [showAll, setShowAll] = useState(false)

  const filtered = useMemo(() => {
    const cutoff = subDays(startOfDay(new Date()), range - 1)
    return exerciseLogs.filter((e) =>
      isWithinInterval(parseISO(e.logged_at), { start: cutoff, end: new Date() })
    )
  }, [exerciseLogs, range])

  const totalCalories = filtered.reduce((s, e) => s + (e.calories ?? 0), 0)
  const totalSessions = filtered.length
  const totalMinutes = filtered.reduce((s, e) => s + (e.duration_min ?? 0), 0)

  if (totalSessions === 0) return null

  const displayed = showAll ? filtered : filtered.slice(0, 3)

  return (
    <div className="rounded-sheet border border-hairline bg-surface p-4 shadow-rest">
      <div className="flex items-center gap-2 mb-3">
        <Dumbbell className="h-4 w-4 text-brand" />
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">Exercise</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-card bg-brand-soft border border-hairline p-2.5 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-2">Sessions</p>
          <p className="text-lg font-bold text-brand-ink mt-0.5 tabular-nums">{totalSessions}</p>
        </div>
        <div className="rounded-card border border-hairline p-2.5 text-center" style={{ background: 'var(--bad-soft)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-2">Burned</p>
          <p className="text-lg font-bold mt-0.5 tabular-nums" style={{ color: 'var(--fat)' }}>{totalCalories.toLocaleString()}</p>
          <p className="text-[10px] text-ink-2">kcal</p>
        </div>
        <div className="rounded-card border border-hairline p-2.5 text-center" style={{ background: 'rgba(53,102,196,0.08)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-2">Time</p>
          <p className="text-lg font-bold mt-0.5 tabular-nums" style={{ color: 'var(--protein)' }}>
            {totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes}m`}
          </p>
        </div>
      </div>

      {/* Session list */}
      <div className="space-y-1.5">
        {displayed.map((e, i) => (
          <div key={i} className="flex items-center justify-between rounded-control bg-surface-2 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Flame className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--fat)' }} />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-ink capitalize truncate">{e.activity}</p>
                <p className="text-[10px] text-ink-2">{format(parseISO(e.logged_at), 'MMM d')} · {e.duration_min} min</p>
              </div>
            </div>
            <span className="text-xs font-bold shrink-0 ml-2 tabular-nums" style={{ color: 'var(--fat)' }}>
              {e.calories > 0 ? `${e.calories} kcal` : '—'}
            </span>
          </div>
        ))}
      </div>

      {filtered.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 w-full text-[11px] font-semibold text-ink-2 hover:text-ink transition-colors"
        >
          {showAll ? 'Show less' : `Show all ${filtered.length} sessions`}
        </button>
      )}
    </div>
  )
}

function StatCard({
  label, value, unit, sub, color, bg,
}: {
  label: string; value: string; unit?: string; sub?: string; color: string; bg: string
}) {
  return (
    <div className={`rounded-card border p-3.5 ${bg}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-2">{label}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={`text-2xl font-bold tabular-nums ${color}`}>{value}</span>
        {unit && <span className="text-xs text-ink-2">{unit}</span>}
      </div>
      {sub && <p className="text-[11px] text-ink-2 mt-0.5">{sub}</p>}
    </div>
  )
}

function MacroCard({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="rounded-card border border-hairline bg-surface p-3 text-center shadow-rest">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-2">{label}</p>
      <p className="text-lg font-bold mt-0.5 tabular-nums" style={{ color }}>{value > 0 ? value : '--'}</p>
      <p className="text-[10px] text-ink-2">{unit}</p>
    </div>
  )
}
