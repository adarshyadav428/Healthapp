'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { format, parseISO, startOfDay, subDays, eachDayOfInterval, parse, isWithinInterval } from 'date-fns'
import type { Profile, WeightLog } from '../../types/index'
import { useUser } from '../../hooks/useUser'
import { DayDiary } from './DayDiary'
import { dateStrToUtcMidnight } from '../../lib/dateUtils'
import { ShareProgressButton } from './ShareProgressButton'
import {
  Flame, Scale, ChevronLeft, ChevronRight, Utensils, CalendarDays, X, Dumbbell, Lock, Crown,
} from 'lucide-react'

// Defer recharts — saves ~95KB on initial /progress load.
const TrendBarChart = dynamic(() => import('./TrendBarChart').then(m => m.TrendBarChart), {
  ssr: false,
  loading: () => <div className="h-[180px] rounded-card bg-surface-2 animate-pulse" />,
})

type LogRow = { logged_at: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; meal: string }
type ExerciseRow = { logged_at: string; activity: string; duration_min: number; calories: number }
type DayData = { date: string; label: string; kcal: number; protein: number; carbs: number; fat: number; logged: boolean }

type Props = {
  streak:      number
  weightLogs:  WeightLog[]
  loggedDates: string[]
  logs:        LogRow[]
  exerciseLogs: ExerciseRow[]
  profile:     Profile
  isPro:       boolean
}

// IST calendar date (YYYY-MM-DD) for a timestamp — matches what the user sees.
function istDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}
function pad(n: number) { return String(n).padStart(2, '0') }

const AIR = { boxShadow: 'var(--shadow-air)' } as const

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
]

const METRIC_CONFIG = {
  kcal:    { color: 'var(--energy)', label: 'Calories', unit: 'kcal' },
  protein: { color: 'var(--protein)', label: 'Protein', unit: 'g' },
  carbs:   { color: 'var(--carbs)', label: 'Carbs', unit: 'g' },
  fat:     { color: 'var(--fat)', label: 'Fat', unit: 'g' },
} as const

export function ProgressClient({ streak, weightLogs, loggedDates, logs, exerciseLogs, profile, isPro }: Props) {
  const { user } = useUser()
  const currentWeight = weightLogs[0]?.weight_kg ?? null
  const target = profile.daily_calorie_target

  const [range, setRange] = useState(7)
  const [metric, setMetric] = useState<keyof typeof METRIC_CONFIG>('kcal')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const metricTargets: Record<string, number> = {
    kcal: profile.daily_calorie_target,
    protein: profile.protein_g_target,
    carbs: profile.carbs_g_target,
    fat: profile.fat_g_target,
  }

  // ── Multi-range, multi-metric chart data ────────────────────────────────────
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
  const avgKcal    = loggedDays.length > 0 ? Math.round(loggedDays.reduce((s, d) => s + d.kcal, 0) / loggedDays.length) : 0
  const avgProtein = loggedDays.length > 0 ? Math.round(loggedDays.reduce((s, d) => s + d.protein, 0) / loggedDays.length) : 0
  const avgCarbs   = loggedDays.length > 0 ? Math.round(loggedDays.reduce((s, d) => s + d.carbs, 0) / loggedDays.length) : 0
  const avgFat     = loggedDays.length > 0 ? Math.round(loggedDays.reduce((s, d) => s + d.fat, 0) / loggedDays.length) : 0
  // Calorie deficit/surplus vs goal (positive = deficit, negative = surplus)
  const avgDeficit = target > 0 && avgKcal > 0 ? target - avgKcal : null

  const cfg = METRIC_CONFIG[metric]

  // ── Month calendar ──────────────────────────────────────────────────────────
  const loggedSet = useMemo(() => new Set(loggedDates.map(istDate)), [loggedDates])
  const istTodayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const [ty, tm, td] = istTodayStr.split('-').map(Number)

  const minOffset = useMemo(() => {
    if (loggedSet.size === 0) return 0
    let earliest = istTodayStr
    for (const d of loggedSet) if (d < earliest) earliest = d
    const [ey, em] = earliest.split('-').map(Number)
    return (ey - ty) * 12 + (em - tm)
  }, [loggedSet, istTodayStr, ty, tm])

  const [offset, setOffset] = useState(0)
  const viewYear = ty + Math.floor((tm - 1 + offset) / 12)
  const viewMonth = ((tm - 1 + offset) % 12 + 12) % 12
  const isCurrentMonth = offset === 0

  const cal = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay()
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
        <p className="text-[13px] font-medium text-ink-3">Your trends over time</p>
        <h1 className="font-display mt-[3px] text-[24px] font-bold tracking-[-0.02em] text-ink">Trends</h1>
      </div>

      {/* ── Free-tier banner ── */}
      {!isPro && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-[20px] p-4" style={{ backgroundColor: 'var(--brand-soft)' }}>
          <div className="flex min-w-0 items-center gap-2.5">
            <Lock className="h-4 w-4 shrink-0 text-brand-ink" />
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold text-brand-ink">Showing last 7 days</p>
              <p className="text-[11px] text-brand-ink opacity-80">Pro unlocks full trends history</p>
            </div>
          </div>
          <Link
            href="/upgrade?reason=history"
            className="flex shrink-0 items-center gap-1 rounded-full bg-cta-grad px-3 py-1.5 text-[11px] font-bold text-white tap-scale"
          >
            <Crown className="h-3 w-3" /> Upgrade
          </Link>
        </div>
      )}

      {/* ── Stat cards: streak + weight ── */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-[24px] bg-surface p-5" style={AIR}>
          <div className="flex h-9 w-9 items-center justify-center rounded-[12px]" style={{ backgroundColor: 'var(--brand-soft)' }}>
            <Flame className="h-[18px] w-[18px] text-brand" strokeWidth={2} />
          </div>
          <p className="font-display mt-3.5 text-[34px] font-bold leading-none tabular-nums text-ink" style={{ letterSpacing: '-0.03em' }}>{streak}</p>
          <p className="mt-[5px] text-[12px] text-ink-3">day streak</p>
        </div>
        <div className="rounded-[24px] bg-surface p-5" style={AIR}>
          <div className="flex h-9 w-9 items-center justify-center rounded-[12px]" style={{ backgroundColor: 'color-mix(in srgb, var(--carbs) 15%, transparent)' }}>
            <Scale className="h-[18px] w-[18px]" strokeWidth={2} style={{ color: 'var(--carbs)' }} />
          </div>
          <p className="font-display mt-3.5 text-[34px] font-bold leading-none tabular-nums text-ink" style={{ letterSpacing: '-0.03em' }}>
            {currentWeight ?? '—'}
          </p>
          <p className="mt-[5px] text-[12px] text-ink-3">kg current</p>
        </div>
      </div>

      {/* Share progress card (WhatsApp/IG image) — hidden when nothing to show yet */}
      <ShareProgressButton
        streakDays={streak}
        startWeightKg={weightLogs[weightLogs.length - 1]?.weight_kg ?? null}
        currentWeightKg={currentWeight}
      />

      {/* ── Stat cards: avg calories + days logged ── */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-[24px] bg-surface p-5" style={AIR}>
          <div className="flex h-9 w-9 items-center justify-center rounded-[12px]" style={{ backgroundColor: 'var(--energy-soft)' }}>
            <Utensils className="h-[18px] w-[18px]" strokeWidth={2} style={{ color: 'var(--energy)' }} />
          </div>
          <p className="font-display mt-3.5 text-[34px] font-bold leading-none tabular-nums text-ink" style={{ letterSpacing: '-0.03em' }}>
            {avgKcal > 0 ? avgKcal.toLocaleString('en-IN') : '—'}
          </p>
          <p className="mt-[5px] text-[12px] text-ink-3">avg kcal{target > 0 ? ` · goal ${target.toLocaleString('en-IN')}` : ''}</p>
        </div>
        <div className="rounded-[24px] bg-surface p-5" style={AIR}>
          <div className="flex h-9 w-9 items-center justify-center rounded-[12px]" style={{ backgroundColor: 'color-mix(in srgb, var(--good) 15%, transparent)' }}>
            <CalendarDays className="h-[18px] w-[18px]" strokeWidth={2} style={{ color: 'var(--good)' }} />
          </div>
          <p className="font-display mt-3.5 text-[34px] font-bold leading-none tabular-nums text-ink" style={{ letterSpacing: '-0.03em' }}>
            {loggedDays.length}
          </p>
          <p className="mt-[5px] text-[12px] text-ink-3">of {range} days logged</p>
        </div>
      </div>

      {/* ── Avg deficit/surplus → links to the (previously orphaned) tracker ── */}
      {avgDeficit !== null && (
        <Link href="/deficit" className="mt-3 block rounded-[24px] bg-surface px-5 py-[18px] tap-scale" style={AIR}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] text-ink-3">Avg daily {avgDeficit >= 0 ? 'deficit' : 'surplus'}</p>
              <p className="font-display mt-1 text-[22px] font-bold tabular-nums" style={{ letterSpacing: '-0.02em', color: avgDeficit >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                {avgDeficit >= 0 ? '-' : '+'}{Math.abs(avgDeficit).toLocaleString('en-IN')} kcal
              </p>
            </div>
            <div className="text-right">
              <p className="text-[12px] text-ink-3">Est. weight {avgDeficit >= 0 ? 'loss' : 'gain'}</p>
              <p className="mt-1 text-[14px] font-bold tabular-nums" style={{ color: avgDeficit >= 0 ? 'var(--good)' : 'var(--bad)' }}>
                {Math.abs(avgDeficit * loggedDays.length / 7700).toFixed(2)} kg / {range}d
              </p>
            </div>
          </div>
          <p className="mt-2.5 flex items-center gap-1 text-[12px] font-semibold text-brand-ink">
            Weekly deficit tracker <ChevronRight className="h-3.5 w-3.5" />
          </p>
        </Link>
      )}

      {/* ── Avg macros ── */}
      <div className="mt-3 grid grid-cols-3 gap-2.5">
        <MacroMiniCard label="Protein" value={avgProtein} color="var(--protein)" />
        <MacroMiniCard label="Carbs" value={avgCarbs} color="var(--carbs)" />
        <MacroMiniCard label="Fat" value={avgFat} color="var(--fat)" />
      </div>

      {/* ── Exercise ── */}
      {exerciseLogs.length > 0 && <ExerciseSection exerciseLogs={exerciseLogs} range={range} />}

      {/* ── Trend chart ── */}
      <div className="mt-3 rounded-[24px] bg-surface p-[22px]" style={AIR}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[15px] font-semibold text-ink">{cfg.label} trend</p>
          <div className="flex gap-1 rounded-full bg-surface-2 p-0.5">
            {RANGES.map((r) => {
              const locked = !isPro && r.days > 7
              return locked ? (
                <Link
                  key={r.days}
                  href="/upgrade?reason=history"
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-ink-3 opacity-70"
                >
                  <Lock className="h-2.5 w-2.5" /> {r.label}
                </Link>
              ) : (
                <button
                  key={r.days}
                  type="button"
                  onClick={() => setRange(r.days)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${range === r.days ? 'bg-surface text-ink' : 'text-ink-3'}`}
                  style={range === r.days ? AIR : undefined}
                >
                  {r.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mb-4 flex gap-1.5">
          {(Object.keys(METRIC_CONFIG) as Array<keyof typeof METRIC_CONFIG>).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-all ${metric === m ? 'text-white' : 'bg-surface-2 text-ink-2'}`}
              style={metric === m ? { backgroundColor: METRIC_CONFIG[m].color } : undefined}
            >
              {METRIC_CONFIG[m].label}
            </button>
          ))}
        </div>

        <TrendBarChart
          chartData={chartData}
          range={range}
          metric={metric}
          metricTarget={metricTargets[metric]}
          color={cfg.color}
          unit={cfg.unit}
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
        />

        <p className="mt-3 text-center text-[11px] text-ink-3">Tap a bar to view that day&apos;s food diary</p>
      </div>

      {/* ── Day diary panel ── */}
      {selectedDate && user && (
        <div className="mt-3 rounded-[24px] bg-surface p-5" style={AIR}>
          <div className="mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-brand" />
              <p className="text-[14px] font-bold text-ink">
                {format(parse(selectedDate, 'yyyy-MM-dd', new Date()), 'EEEE, MMM d')}
              </p>
            </div>
            <button type="button" onClick={() => setSelectedDate(null)} className="rounded-full p-1 tap-scale">
              <X className="h-4 w-4 text-ink-2" />
            </button>
          </div>
          <DayDiary userId={user.id} date={dateStrToUtcMidnight(selectedDate)} />
        </div>
      )}

      {/* ── Calorie breakdown by day ── */}
      {loggedDays.length > 0 && (
        <div className="mt-3 rounded-[24px] bg-surface p-5" style={AIR}>
          <p className="mb-3.5 text-[13px] font-semibold text-ink">Calorie breakdown by day</p>
          <div className="space-y-2">
            {[...chartData].reverse().slice(0, 7).map((day) => {
              const pct = target > 0 ? Math.min((day.kcal / target) * 100, 100) : 0
              const barColor = day.kcal === 0 ? 'var(--surface-2)' : day.kcal > target * 1.1 ? 'var(--bad)' : day.kcal >= target * 0.9 ? 'var(--good)' : 'var(--brand)'
              const isSelected = selectedDate === day.date
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(isSelected ? null : day.date)}
                  className={`-mx-2 flex w-full items-center gap-3 rounded-[14px] px-2 py-1.5 transition-colors ${isSelected ? 'bg-brand-soft' : ''}`}
                >
                  <span className={`w-14 shrink-0 text-[11.5px] font-medium ${isSelected ? 'font-bold text-brand-ink' : 'text-ink-2'}`}>{day.label}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: day.kcal === 0 ? '0%' : `${pct}%`, background: isSelected ? 'var(--brand)' : barColor }}
                    />
                  </div>
                  <span className={`w-16 shrink-0 text-right text-[11.5px] font-bold tabular-nums ${isSelected ? 'text-brand-ink' : 'text-ink'}`}>
                    {day.kcal > 0 ? `${day.kcal.toLocaleString()} kcal` : '—'}
                  </span>
                </button>
              )
            })}
          </div>
          {target > 0 && (
            <div className="mt-3.5 flex items-center gap-3 text-[10px] text-ink-3">
              <div className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--good)' }} /> On target</div>
              <div className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-brand" /> Under target</div>
              <div className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--bad)' }} /> Over target</div>
            </div>
          )}
        </div>
      )}

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

function MacroMiniCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-[18px] bg-surface p-3.5 text-center" style={AIR}>
      <p className="text-[16px] font-bold tabular-nums" style={{ color }}>{value > 0 ? value : '—'}</p>
      <p className="mt-0.5 text-[10.5px] text-ink-3">{label}</p>
    </div>
  )
}

function ExerciseSection({ exerciseLogs, range }: { exerciseLogs: ExerciseRow[]; range: number }) {
  const [showAll, setShowAll] = useState(false)

  const filtered = useMemo(() => {
    const cutoff = subDays(startOfDay(new Date()), range - 1)
    return exerciseLogs.filter((e) => isWithinInterval(parseISO(e.logged_at), { start: cutoff, end: new Date() }))
  }, [exerciseLogs, range])

  const totalCalories = filtered.reduce((s, e) => s + (e.calories ?? 0), 0)
  const totalSessions = filtered.length
  const totalMinutes = filtered.reduce((s, e) => s + (e.duration_min ?? 0), 0)

  if (totalSessions === 0) return null

  const displayed = showAll ? filtered : filtered.slice(0, 3)

  return (
    <div className="mt-3 rounded-[24px] bg-surface p-5" style={AIR}>
      <div className="mb-3.5 flex items-center gap-2">
        <Dumbbell className="h-4 w-4 text-brand" />
        <p className="text-[13px] font-semibold text-ink">Exercise</p>
      </div>

      <div className="mb-3.5 grid grid-cols-3 gap-2">
        <div className="rounded-[14px] bg-brand-soft p-2.5 text-center">
          <p className="text-[10px] font-semibold text-ink-3">Sessions</p>
          <p className="mt-0.5 text-[16px] font-bold tabular-nums text-brand-ink">{totalSessions}</p>
        </div>
        <div className="rounded-[14px] p-2.5 text-center" style={{ background: 'var(--bad-soft)' }}>
          <p className="text-[10px] font-semibold text-ink-3">Burned</p>
          <p className="mt-0.5 text-[16px] font-bold tabular-nums" style={{ color: 'var(--fat)' }}>{totalCalories.toLocaleString()}</p>
          <p className="text-[9.5px] text-ink-3">kcal</p>
        </div>
        <div className="rounded-[14px] p-2.5 text-center" style={{ background: 'color-mix(in srgb, var(--protein) 8%, transparent)' }}>
          <p className="text-[10px] font-semibold text-ink-3">Time</p>
          <p className="mt-0.5 text-[16px] font-bold tabular-nums" style={{ color: 'var(--protein)' }}>
            {totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes}m`}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        {displayed.map((e, i) => (
          <div key={i} className="flex items-center justify-between rounded-[12px] bg-surface-2 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <Flame className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--fat)' }} />
              <div className="min-w-0">
                <p className="truncate text-[12px] font-semibold capitalize text-ink">{e.activity}</p>
                <p className="text-[10px] text-ink-3">{format(parseISO(e.logged_at), 'MMM d')} · {e.duration_min} min</p>
              </div>
            </div>
            <span className="ml-2 shrink-0 text-[12px] font-bold tabular-nums" style={{ color: 'var(--fat)' }}>
              {e.calories > 0 ? `${e.calories} kcal` : '—'}
            </span>
          </div>
        ))}
      </div>

      {filtered.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2.5 w-full text-[11px] font-semibold text-ink-3 tap-scale"
        >
          {showAll ? 'Show less' : `Show all ${filtered.length} sessions`}
        </button>
      )}
    </div>
  )
}
