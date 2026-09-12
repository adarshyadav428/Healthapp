'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { Profile, WeightLog } from '../../types/index'
import { useUser } from '../../hooks/useUser'
import { DayDiary } from './DayDiary'
import { dateStrToUtcMidnight, formatIst, istDateStr, istDaysAgoStart } from '../../lib/dateUtils'
import { lastIstDateStrs } from '../../lib/logDates'
import { ShareProgressButton } from './ShareProgressButton'
import { firstNameFrom } from '../../lib/shareCard'
import { computeWeightTrend } from '../../lib/weightTrend'
import { contextInsight, contextInsightLine } from '../../lib/mealContext'
import { BadgeShelf } from './BadgeShelf'
import type { BadgeStats } from '../../lib/badges'
import { DeficitTrendCard, type DeficitPeriodView } from './DeficitTrendCard'
import { WeightHero } from './WeightHero'
import { SegmentedControl } from '../ui/segmented-control'
import { bmiCategory, computeBmi } from '../../lib/bmi'
import { ChevronLeft, ChevronRight, X, Dumbbell, Lock, Flame } from 'lucide-react'

// Defer recharts — saves ~95KB on initial /progress load.
const TrendBarChart = dynamic(() => import('./TrendBarChart').then(m => m.TrendBarChart), {
  ssr: false,
  loading: () => <div className="h-44 animate-shimmer rounded-card bg-surface-2" />,
})

type LogRow = { logged_at: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number; meal: string; context?: string | null }
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
  /** Free history window in days, resolved server-side from the signup cohort. */
  freeHistoryDays: number
  /** Lifetime counters for the badge shelf. Badges are free — never Pro-gated. */
  badgeStats?: BadgeStats
  /** This week's energy balance, computed server-side from the shared calculator. */
  weekView: DeficitPeriodView
  /** Null for free accounts — the month is Pro, and the gate is server-side. */
  monthView: DeficitPeriodView | null
  /** Maintenance (TDEE). The one benchmark the deficit surfaces measure against. */
  maintenanceKcal: number
}

// IST calendar date (YYYY-MM-DD) for a timestamp — matches what the user sees.
function istDate(iso: string) {
  return istDateStr(new Date(iso))
}
/** A YYYY-MM-DD IST date as a label. UTC midnight of that date is still that
 *  same date in IST (+5:30 lands at 05:30), so no day can slip here. */
function dayLabel(dateStr: string, options: Intl.DateTimeFormatOptions) {
  return formatIst(dateStrToUtcMidnight(dateStr), options, 'en-US')
}
function pad(n: number) { return String(n).padStart(2, '0') }

const METRIC_CONFIG = {
  kcal:    { color: 'var(--energy)', label: 'Calories', unit: 'kcal' },
  protein: { color: 'var(--protein)', label: 'Protein', unit: 'g' },
  carbs:   { color: 'var(--carbs)', label: 'Carbs', unit: 'g' },
  fat:     { color: 'var(--fat)', label: 'Fat', unit: 'g' },
} as const

export function ProgressClient({
  streak, weightLogs, loggedDates, logs, exerciseLogs, profile, isPro, freeHistoryDays, badgeStats,
  weekView, monthView, maintenanceKcal,
}: Props) {
  const { user } = useUser()
  // weightLogs arrives newest-first and capped at 30, so its last element is
  // "oldest of the last 30 weigh-ins" — not the start weight. Prefer the
  // immutable onboarding baseline, same rule WeightStats uses (P1-9b), so the
  // share card and the Weight page can't disagree.
  const currentWeight = weightLogs[0]?.weight_kg ?? null
  const startWeight = profile.start_weight_kg ?? weightLogs[weightLogs.length - 1]?.weight_kg ?? null

  // Smoothed trend + projection. Needs 14+ days of weigh-ins; below that it
  // returns a null rate and this whole surface stays hidden rather than
  // showing a slope fitted to noise.
  const trend = useMemo(
    () => computeWeightTrend(weightLogs, profile.target_weight_kg ?? null),
    [weightLogs, profile.target_weight_kg]
  )
  const [range, setRange] = useState(freeHistoryDays)
  const [metric, setMetric] = useState<keyof typeof METRIC_CONFIG>('kcal')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // The free window is always the first (unlocked) chip, so a post-cutoff user
  // whose window isn't 7 still sees a range that matches what's on the chart.
  // 14/30 stay Pro-locked. Legacy users get the unchanged 7/14/30.
  const ranges = useMemo(() => {
    const wider = [14, 30].filter((d) => d > freeHistoryDays)
    return [{ days: freeHistoryDays }, ...wider.map((d) => ({ days: d }))].map((r) => ({
      days: r.days,
      label: `${r.days} days`,
    }))
  }, [freeHistoryDays])

  // Oldest IST day a free account can open a diary for. A day selected before
  // this is withheld server-side, so DayDiary must say "Pro" rather than the
  // literally-false "Nothing logged on this day".
  const freeWindowCutoff = istDate(
    new Date(Date.now() - (freeHistoryDays - 1) * 86_400_000).toISOString()
  )

  const metricTargets: Record<string, number> = {
    kcal: profile.daily_calorie_target,
    protein: profile.protein_g_target,
    carbs: profile.carbs_g_target,
    fat: profile.fat_g_target,
  }

  // ── Multi-range, multi-metric chart data ────────────────────────────────────
  // Both the day list and the grouping key are IST. They used to be date-fns'
  // *local* day — correct only for a device already on IST, and silently off by
  // one for every other, which put a meal in the wrong bar and mislabelled the
  // bar it landed in (audit 2026-09-03, P1-8).
  const chartData: DayData[] = useMemo(() => {
    const todayStr = istDateStr()
    const days = lastIstDateStrs(range, todayStr)

    const byDay = new Map<string, { kcal: number; protein: number; carbs: number; fat: number }>()
    for (const log of logs) {
      const key = istDate(log.logged_at)
      const existing = byDay.get(key) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      byDay.set(key, {
        kcal: existing.kcal + log.kcal,
        protein: existing.protein + log.protein_g,
        carbs: existing.carbs + log.carbs_g,
        fat: existing.fat + log.fat_g,
      })
    }

    return days.map((key) => {
      const data = byDay.get(key)
      const isToday = key === todayStr
      return {
        date: key,
        label: range <= 7
          ? dayLabel(key, { weekday: 'short' })
          : dayLabel(key, { month: 'short', day: 'numeric' }),
        kcal: Math.round(data?.kcal ?? 0),
        protein: Math.round(data?.protein ?? 0),
        carbs: Math.round(data?.carbs ?? 0),
        fat: Math.round(data?.fat ?? 0),
        logged: !!data && !isToday,
      }
    })
  }, [logs, range])

  // Averages describe a *typical day*, so today — which has only breakfast in it
  // — must stay out, or every average drops the moment someone logs honestly.
  // `chartData.logged` already means "has data and isn't today".
  const completeDays = chartData.filter((d) => d.logged)
  const avgProtein = completeDays.length > 0 ? Math.round(completeDays.reduce((s, d) => s + d.protein, 0) / completeDays.length) : 0
  const avgCarbs   = completeDays.length > 0 ? Math.round(completeDays.reduce((s, d) => s + d.carbs, 0) / completeDays.length) : 0
  const avgFat     = completeDays.length > 0 ? Math.round(completeDays.reduce((s, d) => s + d.fat, 0) / completeDays.length) : 0

  // The counter, unlike the averages, credits today: the user did log it.
  const daysLoggedCount = chartData.filter((d) => d.kcal > 0).length

  // Only speaks with enough evidence on both sides and a gap worth a sentence —
  // an app that announces a pattern from two data points teaches people to
  // ignore its patterns.
  const contextLine = useMemo(() => contextInsightLine(contextInsight(logs)), [logs])

  // Deficit rows for the share chooser. `monthView` is null for free accounts —
  // the gate is server-side (app/progress/page.tsx), so nothing here decides it.
  // A fallback period is dropped rather than shared: the card says "This week",
  // and a card that says "This week" about last week is a lie, not a rounding.
  // The card's byline. Null for an anonymous account (display_name is
  // nullable), and the card then omits the line rather than drawing a blank.
  const firstName = firstNameFrom(profile.display_name)

  const shareDeficits = useMemo(
    () =>
      [weekView, monthView]
        .filter((v): v is DeficitPeriodView => v != null && !v.isFallback)
        .map((v) => ({
          kcal: v.summary.total_deficit,
          period: v.kind,
          daysLogged: v.summary.days_logged,
          fatKg: v.summary.fat_loss_achieved_kg,
        })),
    [weekView, monthView]
  )
  const cfg = METRIC_CONFIG[metric]

  // ── Month calendar ──────────────────────────────────────────────────────────
  const loggedSet = useMemo(() => new Set(loggedDates.map(istDate)), [loggedDates])
  const istTodayStr = istDateStr()
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
    // UTC arithmetic, read back with UTC getters. How many days a month has and
    // which weekday it opens on do not depend on a timezone — but building the
    // date locally and reading it locally only *happens* to agree, and it is
    // the construct the day-boundary rule exists to keep out of this file.
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate()
    const firstWeekday = new Date(Date.UTC(viewYear, viewMonth, 1)).getUTCDay()
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
    // Date.UTC, not the local constructor: the calendar's own cells are built
    // from IST fields, so its heading has to be read back in the same zone.
    const monthLabel = formatIst(Date.UTC(viewYear, viewMonth, 1), {
      month: 'long', ...(viewYear !== ty ? { year: 'numeric' } : {}),
    }, 'en-US')
    return { cells, logged, elapsed, monthLabel }
  }, [viewYear, viewMonth, isCurrentMonth, td, ty, loggedSet])

  // Supporting numbers — a glance, not a dashboard. BMI is the one body figure
  // the app has; it reads off the same current weight the hero shows.
  const bmi = profile.height_cm ? computeBmi(currentWeight ?? profile.current_weight_kg, profile.height_cm) : null
  const bmiLabel = bmi != null ? BMI_LABEL[bmiCategory(bmi)] : null

  // The last seven IST days as dots on the streak banner — the same set the
  // calendar draws, just the tail of it.
  const lastSeven = lastIstDateStrs(7, istTodayStr).map((key) => ({ key, logged: loggedSet.has(key), isToday: key === istTodayStr }))

  return (
    <>
      {/* ── Header ── */}
      <header className="flex items-end justify-between gap-4 pt-2">
        <div>
          <p className="text-caption font-medium text-ink-3">Your trends</p>
          <h1 className="font-display mt-1 text-title font-semibold text-ink">Progress</h1>
        </div>
        {!isPro && (
          <Link
            href="/upgrade?reason=history"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-surface px-3.5 text-caption font-semibold text-ink tap-scale"
          >
            <Lock className="h-3.5 w-3.5 text-ink-3" strokeWidth={1.75} /> Last {freeHistoryDays} days
          </Link>
        )}
      </header>

      {/* ── Streak: the habit, in ember. The one loud object on the page. ── */}
      <section
        aria-label="Streak"
        className="mt-5 flex items-center gap-4 rounded-card-lg bg-cta-grad px-4 py-4 text-white shadow-cta"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/20">
          <Flame className="h-7 w-7" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-1.5">
            <span className="font-display text-display font-semibold tabular-nums leading-none">{streak}</span>
            <span className="text-body font-medium text-white/85">day streak</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <ul className="flex shrink-0 gap-1" aria-label="Last 7 days">
              {lastSeven.map((d) => (
                <li
                  key={d.key}
                  aria-label={d.logged ? 'Logged' : 'Not logged'}
                  className={`h-2.5 w-2.5 rounded-full ${d.logged ? 'bg-white' : 'bg-white/30'} ${d.isToday ? 'ring-2 ring-white/50' : ''}`}
                />
              ))}
            </ul>
            <p className="text-caption text-white/80">
              <span className="font-semibold text-white">{cal.logged} of {cal.elapsed}</span> days this month
            </p>
          </div>
        </div>
      </section>

      <div className="lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
        {/* ── Left: where you stand ── */}
        <div className="mt-4 lg:sticky lg:top-6">
          {/* The leading indicator first: the scale confirms in a fortnight
              what this already knows today. */}
          <div className="rounded-card-lg border-2 border-hairline-2 px-4 pb-4 pt-4">
            <DeficitTrendCard
              week={weekView}
              month={monthView}
              goal={profile.goal}
              isPro={isPro}
            />
          </div>

          <div className="mt-4 rounded-card-lg border-2 border-hairline-2 px-4 pb-4 pt-4">
            <WeightHero weightLogs={weightLogs} profile={profile} trend={trend} bmi={bmi} bmiLabel={bmiLabel} />
          </div>
        </div>

        {/* ── Right: what you ate, and the habit that got you here ── */}
        <div className="mt-4">
          <section aria-label="Calories and macros" className="rounded-card-lg border-2 border-hairline-2 px-4 pb-4 pt-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-title-sm font-semibold text-ink">Intake</h2>
              <div role="tablist" aria-label="Range" className="flex gap-1 rounded-control bg-surface-2 p-1">
                {ranges.map((r) => {
                  const locked = !isPro && r.days > freeHistoryDays
                  const cls = 'flex h-10 items-center gap-1 rounded-lg px-3 text-caption font-semibold transition-colors'
                  return locked ? (
                    <Link key={r.days} href="/upgrade?reason=history" aria-label={`${r.label} — upgrade to Pro`} className={`${cls} text-ink-3`}>
                      <Lock className="h-3 w-3" /> {r.days}d
                    </Link>
                  ) : (
                    <button
                      key={r.days}
                      type="button"
                      role="tab"
                      aria-selected={range === r.days}
                      onClick={() => setRange(r.days)}
                      className={`${cls} ${range === r.days ? 'bg-surface text-ink shadow-air' : 'text-ink-2'}`}
                    >
                      {r.days}d
                    </button>
                  )
                })}
              </div>
            </div>

            <SegmentedControl
              className="mt-3"
              aria-label="Metric"
              value={metric}
              onChange={setMetric}
              options={(Object.keys(METRIC_CONFIG) as Array<keyof typeof METRIC_CONFIG>).map((m) => ({
                value: m,
                label: METRIC_CONFIG[m].label,
              }))}
            />

            {daysLoggedCount === 0 ? (
              <p className="mt-4 rounded-card border border-dashed border-hairline px-4 py-6 text-center text-body text-ink-2">
                Nothing logged in the last {range} days. Log a meal and your days appear here.
              </p>
            ) : (
              <>
                <div className="mt-4">
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
                </div>

                {/* Averages describe a typical day — today, with only breakfast in
                    it, is left out (see completeDays). */}
                <dl className="mt-3 grid grid-cols-3 divide-x divide-hairline text-center">
                  {[
                    { label: 'Protein', value: avgProtein, swatch: 'bg-protein' },
                    { label: 'Carbs', value: avgCarbs, swatch: 'bg-carbs' },
                    { label: 'Fat', value: avgFat, swatch: 'bg-fat' },
                  ].map(({ label, value, swatch }) => (
                    <div key={label}>
                      <dt className="flex items-center justify-center gap-1.5 text-micro font-medium text-ink-3">
                        <span className={`h-2 w-2 rounded-sm ${swatch}`} aria-hidden />{label} · avg
                      </dt>
                      <dd className="mt-0.5 text-body font-semibold tabular-nums text-ink">{value > 0 ? `${value} g` : '—'}</dd>
                    </div>
                  ))}
                </dl>

                {contextLine && <p className="mt-4 text-caption text-ink-2">{contextLine}</p>}
                {!selectedDate && (
                  <p className="mt-3 text-micro text-ink-3">
                    {metricTargets[metric] > 0 && <>Dashed line is your {metricTargets[metric].toLocaleString('en-IN')} {cfg.unit} goal · </>}
                    Tap a bar to open that day.
                  </p>
                )}
              </>
            )}

            {/* ── Day diary — the one card on this half, because it is a thing
                you opened, not a section of the page. ── */}
            {selectedDate && user && (
              <div className="mt-4 rounded-card-lg border border-hairline bg-surface px-4 pb-4 pt-3 shadow-air">
                <div className="flex items-center justify-between">
                  <h3 className="text-body font-semibold text-ink">
                    {dayLabel(selectedDate, { weekday: 'long', month: 'short', day: 'numeric' })}
                  </h3>
                  <button type="button" onClick={() => setSelectedDate(null)} aria-label="Close day" className="-mr-2 grid h-11 w-11 place-items-center rounded-full text-ink-3 tap-scale hover:bg-surface-2">
                    <X className="h-5 w-5" strokeWidth={1.75} />
                  </button>
                </div>
                <DayDiary
                  firstName={firstName}
                  userId={user.id}
                  date={dateStrToUtcMidnight(selectedDate)}
                  beyondFreeWindow={!isPro && selectedDate < freeWindowCutoff}
                  freeHistoryDays={freeHistoryDays}
                />
              </div>
            )}
          </section>

          {exerciseLogs.length > 0 && <ExerciseSection exerciseLogs={exerciseLogs} range={range} />}

          {/* ── Month calendar: the habit, one dot a day ── */}
          <section aria-label="Days logged" className="mt-4 rounded-card-lg border-2 border-hairline-2 px-4 pb-4 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-title-sm font-semibold text-ink">{cal.monthLabel}</h2>
              <nav aria-label="Change month" className="-mr-2 flex">
                <button
                  type="button"
                  onClick={() => setOffset((o) => Math.max(minOffset, o - 1))}
                  disabled={offset <= minOffset}
                  aria-label="Previous month"
                  className="grid h-11 w-11 place-items-center rounded-full text-ink-2 tap-scale hover:bg-surface-2 disabled:opacity-40"
                >
                  <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
                </button>
                <button
                  type="button"
                  onClick={() => setOffset((o) => Math.min(0, o + 1))}
                  disabled={offset >= 0}
                  aria-label="Next month"
                  className="grid h-11 w-11 place-items-center rounded-full text-ink-2 tap-scale hover:bg-surface-2 disabled:opacity-40"
                >
                  <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
                </button>
              </nav>
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1.5 text-center text-micro font-medium text-ink-3" aria-hidden>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1.5">
              {cal.cells.map((c, i) => {
                if (c === null) return <div key={i} className="aspect-square" />
                const future = isCurrentMonth && c.day > td
                const today = isCurrentMonth && c.day === td
                // Soft ember for a logged day, a quiet disc for a missed one,
                // nothing at all for a day that has not happened yet.
                const tone = c.logged
                  ? 'bg-cta-grad font-semibold text-white'
                  : future ? 'text-ink-3' : 'bg-surface-2 text-ink-3'
                return (
                  <div
                    key={i}
                    className={`grid aspect-square place-items-center rounded-full text-caption tabular-nums ${tone} ${today ? 'ring-2 ring-ink ring-offset-2 ring-offset-canvas' : ''}`}
                    aria-label={c.logged ? `${c.day}, logged` : future ? String(c.day) : `${c.day}, not logged`}
                  >
                    {c.day}
                  </div>
                )
              })}
            </div>
            <p className="mt-3 text-caption text-ink-2">
              <span className="font-semibold text-ink">{cal.logged} of {cal.elapsed}</span> days logged this month
            </p>
          </section>

          {/* ── Achievements: subordinate to the numbers above, never gated ── */}
          {badgeStats && (
            <div className="mt-4 rounded-card-lg border-2 border-hairline-2 px-4 pb-4 pt-4">
              <BadgeShelf stats={badgeStats} />
            </div>
          )}

          <div className="mt-4">
            <ShareProgressButton
              streakDays={streak}
              startWeightKg={startWeight}
              currentWeightKg={currentWeight}
              deficits={shareDeficits}
              firstName={firstName}
            />
          </div>
        </div>
      </div>
    </>
  )
}

const BMI_LABEL: Record<ReturnType<typeof bmiCategory>, string> = {
  underweight: 'Underweight',
  healthy: 'Healthy',
  overweight: 'Overweight',
  obese: 'Obese',
}

function ExerciseSection({ exerciseLogs, range }: { exerciseLogs: ExerciseRow[]; range: number }) {
  const [showAll, setShowAll] = useState(false)

  const filtered = useMemo(() => {
    // Same window the chart above draws, so the two can't disagree: the start
    // of the IST day `range - 1` days back. Compared as parsed instants, never
    // as strings — a lexicographic compare of timestamps is how the free-tier
    // history clamp was bypassed (P1-1).
    const cutoffMs = Date.parse(istDaysAgoStart(range))
    const nowMs = Date.now()
    return exerciseLogs.filter((e) => {
      const t = Date.parse(e.logged_at)
      return Number.isFinite(t) && t >= cutoffMs && t <= nowMs
    })
  }, [exerciseLogs, range])

  const totalCalories = filtered.reduce((s, e) => s + (e.calories ?? 0), 0)
  const totalSessions = filtered.length
  const totalMinutes = filtered.reduce((s, e) => s + (e.duration_min ?? 0), 0)

  if (totalSessions === 0) return null

  const displayed = showAll ? filtered : filtered.slice(0, 3)
  const time = totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes}m`

  return (
    <section aria-label="Exercise" className="mt-4 rounded-card-lg border-2 border-hairline-2 px-4 pb-4 pt-4">
      <h2 className="font-display text-title-sm font-semibold text-ink">Exercise</h2>
      <p className="mt-1 text-caption tabular-nums text-ink-2">
        {totalSessions} {totalSessions === 1 ? 'session' : 'sessions'} · {totalCalories.toLocaleString('en-IN')} kcal · {time}
      </p>
      <ul className="mt-2 divide-y divide-hairline">
        {displayed.map((e, i) => (
          <li key={i} className="flex items-center gap-3 py-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-2">
              <Dumbbell className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-medium capitalize text-ink">{e.activity}</p>
              <p className="text-caption text-ink-3">{formatIst(e.logged_at, { month: 'short', day: 'numeric' }, 'en-US')} · {e.duration_min} min</p>
            </div>
            <span className="shrink-0 text-body font-semibold tabular-nums text-ink">
              {e.calories > 0 ? `${e.calories} kcal` : '—'}
            </span>
          </li>
        ))}
      </ul>
      {filtered.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-1 flex h-11 items-center text-caption font-semibold text-brand-text tap-scale"
        >
          {showAll ? 'Show less' : `Show all ${filtered.length} sessions`}
        </button>
      )}
    </section>
  )
}
