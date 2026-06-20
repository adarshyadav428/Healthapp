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
  loading: () => <div className="h-[180px] rounded-2xl bg-card border border-border animate-pulse" />,
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
    kcal: { color: '#ea580c', label: 'Calories', unit: 'kcal' },
    protein: { color: '#3b82f6', label: 'Protein', unit: 'g' },
    carbs: { color: '#f59e0b', label: 'Carbs', unit: 'g' },
    fat: { color: '#ef4444', label: 'Fat', unit: 'g' },
  }

  const cfg = metricConfig[metric]

  return (
    <div className="space-y-4">
      {/* Free-tier upgrade banner */}
      {!isPro && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">Showing last 7 days</p>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">Pro unlocks full history</p>
            </div>
          </div>
          <Link
            href="/upgrade?reason=history"
            className="shrink-0 flex items-center gap-1 rounded-full bg-orange-500 hover:bg-orange-600 px-3 py-1.5 text-xs font-bold text-white transition-colors"
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
          color="text-orange-600 dark:text-orange-400"
          bg="bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30"
        />
        <StatCard
          label="Days logged"
          value={String(loggedDays.length)}
          unit={`of ${range}`}
          sub={streakCount > 0 ? `🔥 ${streakCount} day streak` : undefined}
          color="text-emerald-600 dark:text-emerald-400"
          bg="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30"
        />
      </div>
      {avgDeficit !== null && (
        <div className={`rounded-2xl border px-4 py-3 flex items-center justify-between ${
          avgDeficit > 0
            ? 'border-emerald-100 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-950/20'
            : 'border-rose-100 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-950/20'
        }`}>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Avg daily {avgDeficit >= 0 ? 'deficit' : 'surplus'}</p>
            <p className={`text-xl font-black mt-0.5 ${avgDeficit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {avgDeficit >= 0 ? '-' : '+'}{Math.abs(avgDeficit).toLocaleString()} kcal
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted">Est. weight {avgDeficit >= 0 ? 'loss' : 'gain'}</p>
            <p className={`text-sm font-bold ${avgDeficit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
              {Math.abs(avgDeficit * loggedDays.length / 7700).toFixed(2)} kg / {range} days
            </p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <MacroCard label="Avg protein" value={avgProtein} unit="g" color="text-blue-600" />
        <MacroCard label="Avg carbs" value={avgCarbs} unit="g" color="text-amber-600" />
        <MacroCard label="Avg fat" value={avgFat} unit="g" color="text-rose-600" />
      </div>

      {/* Exercise summary */}
      {exerciseLogs.length > 0 && (
        <ExerciseSection exerciseLogs={exerciseLogs} range={range} />
      )}

      {/* Chart card */}
      <div className="rounded-3xl border border-gray-100 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
        {/* Range tabs */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{cfg.label} trend</p>
          <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-slate-800 p-0.5">
            {RANGES.map((r) => {
              const locked = !isPro && r.days > 7
              return locked ? (
                <Link
                  key={r.days}
                  href="/upgrade?reason=history"
                  className="rounded-lg px-2.5 py-1 text-xs font-semibold text-muted flex items-center gap-1 opacity-60 hover:opacity-80 transition-opacity"
                >
                  <Lock className="h-3 w-3" />
                  {r.label}
                </Link>
              ) : (
                <button
                  key={r.days}
                  type="button"
                  onClick={() => setRange(r.days)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    range === r.days ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-muted'
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
              className={`rounded-xl px-3 py-1 text-xs font-semibold transition-all ${
                metric === m
                  ? 'text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-slate-800 text-muted hover:bg-gray-200 dark:hover:bg-slate-700'
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

        <p className="mt-2 text-[10px] text-muted text-center">
          Tap a bar to view that day&apos;s food diary
        </p>
      </div>

      {/* Day diary panel */}
      {selectedDate && user && (
        <div className="rounded-3xl border border-purple-100 dark:border-purple-900/30 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-purple-500 dark:text-purple-400" />
              <p className="text-sm font-bold text-foreground">
                {format(parse(selectedDate, 'yyyy-MM-dd', new Date()), 'EEEE, MMM d')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4 text-muted" />
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
        <div className="rounded-3xl border border-gray-100 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Calorie breakdown by day</p>
          <div className="space-y-2">
            {[...chartData].reverse().slice(0, 7).map((day) => {
              const pct = target > 0 ? Math.min((day.kcal / target) * 100, 100) : 0
              const color = day.kcal === 0 ? 'bg-gray-200 dark:bg-slate-700' : day.kcal > target * 1.1 ? 'bg-rose-400' : day.kcal >= target * 0.9 ? 'bg-emerald-400' : 'bg-orange-400'
              const isSelected = selectedDate === day.date
            return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(isSelected ? null : day.date)}
                  className={`flex items-center gap-3 w-full rounded-xl px-2 py-1 -mx-2 transition-colors ${isSelected ? 'bg-purple-50 dark:bg-purple-950/30' : 'hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                >
                  <span className={`w-14 text-xs font-medium shrink-0 ${isSelected ? 'text-purple-700 dark:text-purple-300 font-bold' : 'text-muted'}`}>{day.label}</span>
                  <div className="flex-1 h-5 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isSelected ? 'bg-purple-400' : color}`}
                      style={{ width: day.kcal === 0 ? '0%' : `${pct}%` }}
                    />
                  </div>
                  <span className={`w-16 text-xs font-bold text-right shrink-0 ${isSelected ? 'text-purple-700 dark:text-purple-300' : 'text-foreground'}`}>
                    {day.kcal > 0 ? `${day.kcal.toLocaleString()} kcal` : '—'}
                  </span>
                </button>
              )
            })}
          </div>
          {target > 0 && (
            <div className="mt-3 flex items-center gap-3 text-[10px] text-muted">
              <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> On target</div>
              <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400 inline-block" /> Under target</div>
              <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400 inline-block" /> Over target</div>
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
    <div className="rounded-3xl border border-gray-100 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Dumbbell className="h-4 w-4 text-violet-500 dark:text-violet-400" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Exercise</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-2xl bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 p-2.5 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Sessions</p>
          <p className="text-lg font-black text-violet-600 dark:text-violet-400 mt-0.5">{totalSessions}</p>
        </div>
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-2.5 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Burned</p>
          <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">{totalCalories.toLocaleString()}</p>
          <p className="text-[10px] text-muted">kcal</p>
        </div>
        <div className="rounded-2xl bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/30 p-2.5 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Time</p>
          <p className="text-lg font-black text-sky-600 dark:text-sky-400 mt-0.5">
            {totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes}m`}
          </p>
        </div>
      </div>

      {/* Session list */}
      <div className="space-y-1.5">
        {displayed.map((e, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-slate-800 px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <Flame className="h-3.5 w-3.5 text-orange-500 dark:text-orange-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground capitalize truncate">{e.activity}</p>
                <p className="text-[10px] text-muted">{format(parseISO(e.logged_at), 'MMM d')} · {e.duration_min} min</p>
              </div>
            </div>
            <span className="text-xs font-bold text-orange-600 dark:text-orange-400 shrink-0 ml-2">
              {e.calories > 0 ? `${e.calories} kcal` : '—'}
            </span>
          </div>
        ))}
      </div>

      {filtered.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 w-full text-[11px] font-semibold text-muted hover:text-foreground transition-colors"
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
    <div className={`rounded-2xl border p-3.5 ${bg}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={`text-2xl font-black ${color}`}>{value}</span>
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </div>
      {sub && <p className="text-[11px] text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

function MacroCard({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 p-3 text-center shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`text-lg font-black mt-0.5 ${color}`}>{value > 0 ? value : '--'}</p>
      <p className="text-[10px] text-muted">{unit}</p>
    </div>
  )
}
