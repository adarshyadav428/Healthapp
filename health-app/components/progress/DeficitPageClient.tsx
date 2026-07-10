'use client'

import { useMemo } from 'react'
import type { ComponentType } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'

const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false })
const Bar       = dynamic(() => import('recharts').then(m => m.Bar as unknown as ComponentType<any>), { ssr: false })
const XAxis     = dynamic(() => import('recharts').then(m => m.XAxis as unknown as ComponentType<any>), { ssr: false })
const YAxis     = dynamic(() => import('recharts').then(m => m.YAxis as unknown as ComponentType<any>), { ssr: false })
const Tooltip   = dynamic(() => import('recharts').then(m => m.Tooltip as unknown as ComponentType<any>), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false })
const Cell      = dynamic(() => import('recharts').then(m => m.Cell as unknown as ComponentType<any>), { ssr: false })
const ReferenceLine = dynamic(() => import('recharts').then(m => m.ReferenceLine as unknown as ComponentType<any>), { ssr: false })

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function getMondayOfWeek(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00Z')
  const day = d.getUTCDay()
  const daysFromMon = day === 0 ? 6 : day - 1
  return new Date(d.getTime() - daysFromMon * 86_400_000).toISOString().slice(0, 10)
}

function addDays(dateKey: string, n: number): string {
  return new Date(new Date(dateKey + 'T00:00:00Z').getTime() + n * 86_400_000).toISOString().slice(0, 10)
}

function getWeekDays(mondayKey: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayKey, i))
}

function formatWeekLabel(mondayKey: string): string {
  const d = new Date(mondayKey + 'T00:00:00Z')
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

interface Props {
  days: { date: string; calories: number }[]
  tdee: number
  eatTarget: number
  actualDailyDeficit: number
  actualWeeklyTarget: number
  impliedPaceKg: number
  today: string
  totalFatKg: number
  totalDaysLogged: number
  targetWeightKg: number | null
  // kept for back-compat but unused
  paceKg?: number
  targetWeeklyKg?: number
}

export function DeficitPageClient({
  days, tdee, eatTarget, actualDailyDeficit, actualWeeklyTarget,
  impliedPaceKg, today, totalFatKg, totalDaysLogged, targetWeightKg,
}: Props) {
  // ── 4 weeks ──
  const weeks = useMemo(() => {
    const currentMonday = getMondayOfWeek(today)
    return Array.from({ length: 4 }, (_, i) => {
      const mondayKey  = addDays(currentMonday, -i * 7)
      const weekDays   = getWeekDays(mondayKey)
      const logsInWeek = weekDays
        .filter(d => d <= today)
        .map(d => ({ date: d, calories: days.find(x => x.date === d)?.calories ?? -1 }))
        .filter(d => d.calories >= 0)
      return { mondayKey, weekDays, logsInWeek }
    }).reverse()
  }, [days, today])

  // For each week, total deficit vs TDEE
  const weekSummaries = useMemo(() =>
    weeks.map(w => {
      const totalDef = w.logsInWeek.reduce((s, l) => s + (tdee - l.calories), 0)
      const daysLog  = w.logsInWeek.length
      const pct      = actualWeeklyTarget > 0 ? Math.min(120, (totalDef / actualWeeklyTarget) * 100) : 0
      return { totalDef, daysLog, pct }
    }), [weeks, tdee, actualWeeklyTarget])

  const chartData = useMemo(() =>
    weeks.map((w, i) => ({
      label:   formatWeekLabel(w.mondayKey),
      deficit: Math.round(weekSummaries[i]?.totalDef ?? 0),
      target:  actualWeeklyTarget,
    })), [weeks, weekSummaries, actualWeeklyTarget])

  // This week (index 3)
  const currentSummary  = weekSummaries[3]
  const thisWeekDeficit = currentSummary?.totalDef ?? 0
  const progressPct     = currentSummary?.pct ?? 0
  const daysLogged      = currentSummary?.daysLog ?? 0
  const isSurplus       = thisWeekDeficit < 0

  // Day bars for current week
  const currentWeekDays = useMemo(() => getWeekDays(getMondayOfWeek(today)), [today])
  const maxBarH = Math.max(
    actualDailyDeficit * 1.5,
    300,
    ...days.map(d => Math.abs(tdee - d.calories))
  )

  const barFill = isSurplus ? 'bg-danger' : progressPct >= 100 ? 'bg-good' : 'bg-brand'

  return (
    <div className="space-y-4">

      {/* ── Hero: the plan ── */}
      <div className="rounded-sheet border border-hairline bg-surface bg-hero-wash p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-ink mb-3">Your plan</p>

        {/* Primary number */}
        <div className="flex items-baseline gap-2 mb-4">
          <span className="font-display text-5xl font-bold text-ink leading-none tabular-nums">
            {eatTarget.toLocaleString()}
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">kcal / day</p>
            <p className="text-[11px] text-ink-2">to eat each day</p>
          </div>
        </div>

        {/* Supporting stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatPill label="Maintenance" value={tdee.toLocaleString()} unit="kcal" />
          <StatPill label="Daily deficit" value={`−${actualDailyDeficit.toLocaleString()}`} unit="kcal" highlight />
          <StatPill label="Goal weight" value={targetWeightKg ? `${targetWeightKg}` : '—'} unit={targetWeightKg ? 'kg' : ''} />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-[11px] text-ink-2">
            At this pace: <span className="font-semibold text-brand-ink">~{impliedPaceKg} kg/week</span>
          </p>
          <Link href="/settings" className="text-[11px] font-semibold text-brand-ink">
            Change pace →
          </Link>
        </div>
      </div>

      {/* ── This week ── */}
      <div className="rounded-sheet border border-hairline bg-surface p-4 shadow-rest">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-3">This week</p>
          {daysLogged > 0 && (
            <p className={`text-xs font-bold ${isSurplus ? 'text-danger' : progressPct >= 100 ? 'text-good' : 'text-brand-ink'}`}>
              {isSurplus ? 'Surplus' : `${Math.round(progressPct)}%`}
            </p>
          )}
        </div>

        <div className="flex items-baseline gap-1.5 mb-2">
          <span className="font-display text-3xl font-bold text-ink leading-none tabular-nums">
            {daysLogged > 0 ? thisWeekDeficit.toLocaleString() : '—'}
          </span>
          {actualWeeklyTarget > 0 && (
            <span className="text-xs text-ink-2">/ {actualWeeklyTarget.toLocaleString()} kcal</span>
          )}
        </div>

        {actualWeeklyTarget > 0 && (
          <div className="h-2.5 rounded-full bg-track overflow-hidden mb-4">
            <div
              className={`h-full rounded-full transition-all duration-700 ${barFill}`}
              style={{ width: `${Math.max(0, Math.min(100, progressPct))}%` }}
            />
          </div>
        )}

        {/* Day bars */}
        <div className="flex items-end gap-1.5 h-12">
          {currentWeekDays.map((date, i) => {
            const log      = days.find(d => d.date === date)
            const isToday  = date === today
            const isFuture = date > today
            const deficit  = log ? tdee - log.calories : 0
            const barH     = log ? Math.max(8, Math.round((Math.abs(deficit) / maxBarH) * 100)) : 0
            const good     = deficit >= 0
            return (
              <div key={date} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex flex-col justify-end h-9">
                  {!isFuture && log ? (
                    <div style={{ height: `${barH}%` }}
                      className={`w-full rounded-t transition-all duration-500 ${good ? 'bg-good' : 'bg-danger'}`} />
                  ) : (
                    <div className={`w-full h-0.5 rounded-full ${isFuture ? 'bg-track' : 'bg-hairline'}`} />
                  )}
                </div>
                <p className={`text-[9px] font-bold ${isToday ? 'text-brand-ink' : 'text-ink-3'}`}>{DAY_LABELS[i]}</p>
                {isToday && <div className="h-0.5 w-3 rounded-full bg-brand" />}
              </div>
            )
          })}
        </div>

        <div className="flex gap-4 mt-2 text-[10px] text-ink-2">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-good inline-block" />Deficit</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-danger inline-block" />Surplus</span>
        </div>

        {daysLogged > 0 && (
          <div className="mt-3 pt-3 border-t border-hairline grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-base font-bold text-ink">{daysLogged}/7</p>
              <p className="text-[10px] text-ink-2">days logged</p>
            </div>
            <div>
              <p className="text-base font-bold text-ink">
                {Math.round(Math.max(0, thisWeekDeficit) / 7700 * 1000) / 1000} kg
              </p>
              <p className="text-[10px] text-ink-2">fat so far</p>
            </div>
            <div>
              <p className="text-base font-bold text-ink">{Math.round(progressPct)}%</p>
              <p className="text-[10px] text-ink-2">of weekly goal</p>
            </div>
          </div>
        )}
      </div>

      {/* ── 4-week chart ── */}
      {chartData.some(d => d.deficit !== 0) && (
        <div className="rounded-sheet border border-hairline bg-surface p-4 shadow-rest">
          <div className="flex items-baseline justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-3">4-week history</p>
            <p className="text-[10px] text-ink-2">goal {actualWeeklyTarget.toLocaleString()} kcal</p>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={32} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--ink-3)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: 'var(--ink-3)' }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'var(--track)', radius: 6 }}
                  content={({ active, payload, label }: { active?: boolean; payload?: { value: unknown }[]; label?: string }) => {
                    if (!active || !payload?.length) return null
                    const val = payload[0]?.value as number
                    return (
                      <div className="rounded-control border border-hairline bg-surface px-3 py-2 shadow-float text-xs">
                        <p className="text-ink-2 mb-0.5">{label}</p>
                        <p className="font-bold" style={{ color: val > 0 ? 'var(--good)' : 'var(--bad)' }}>
                          {val > 0 ? '' : '−'}{Math.abs(val).toLocaleString()} kcal
                        </p>
                        {val > 0 && <p className="text-ink-2">{(val / 7700).toFixed(2)} kg fat</p>}
                      </div>
                    )
                  }}
                />
                <ReferenceLine y={actualWeeklyTarget} stroke="var(--brand)" strokeDasharray="4 2" strokeWidth={1.5}
                  label={{ value: 'Goal', position: 'right', fontSize: 9, fill: 'var(--brand)' }} />
                <Bar dataKey="deficit" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell key={i}
                      fill={entry.deficit >= entry.target * 0.9 ? 'var(--good)' : entry.deficit > 0 ? 'var(--brand)' : 'var(--bad)'}
                      opacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── All time ── */}
      <div className="rounded-sheet border border-hairline bg-surface p-4 shadow-rest">
        <p className="text-[10px] font-bold uppercase tracking-widest text-ink-3 mb-3">All time</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-card bg-brand-soft border border-hairline p-3">
            <p className="text-[10px] text-ink-2 mb-1">Total fat burned</p>
            <p className="text-xl font-bold text-brand-ink">{totalFatKg} kg</p>
            <p className="text-[10px] text-ink-2">= {Math.round(totalFatKg * 1000)}g</p>
          </div>
          <div className="rounded-card bg-surface-2 border border-hairline p-3">
            <p className="text-[10px] text-ink-2 mb-1">Days logged</p>
            <p className="text-xl font-bold text-ink">{totalDaysLogged}</p>
            <p className="text-[10px] text-ink-2">since you joined</p>
          </div>
        </div>
      </div>

    </div>
  )
}

function StatPill({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div className="rounded-card bg-surface border border-hairline px-2.5 py-2 text-center">
      <p className="text-[9px] font-semibold text-ink-3 uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm font-bold leading-tight ${highlight ? 'text-brand-ink' : 'text-ink'}`}>{value}</p>
      {unit && <p className="text-[9px] text-ink-3">{unit}</p>}
    </div>
  )
}
