'use client'

import { useMemo } from 'react'
import type { ComponentType } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { formatKg } from '../../lib/formatWeight'
import type { Maintenance } from '../../lib/tdee'
import type { WeeklyDeficitSummary } from '../../lib/deficit-calculator'
import type { Profile } from '../../types/index'
import { EnergyBar } from './EnergyBar'
import { MaintenanceBreakdown } from './MaintenanceBreakdown'

const BarChart = dynamic(() => import('recharts').then(m => m.BarChart), { ssr: false })
const Bar       = dynamic(() => import('recharts').then(m => m.Bar as unknown as ComponentType<any>), { ssr: false })
const XAxis     = dynamic(() => import('recharts').then(m => m.XAxis as unknown as ComponentType<any>), { ssr: false })
const YAxis     = dynamic(() => import('recharts').then(m => m.YAxis as unknown as ComponentType<any>), { ssr: false })
const Tooltip   = dynamic(() => import('recharts').then(m => m.Tooltip as unknown as ComponentType<any>), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false })
const Cell      = dynamic(() => import('recharts').then(m => m.Cell as unknown as ComponentType<any>), { ssr: false })
const ReferenceLine = dynamic(() => import('recharts').then(m => m.ReferenceLine as unknown as ComponentType<any>), { ssr: false })

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export type WeekView = {
  weekStart: string
  label: string
  summary: WeeklyDeficitSummary
  days: { date: string; kcal: number | null; state: 'done' | 'today' | 'future' | 'missed' }[]
}

interface Props {
  /** Oldest first; the current week is last. */
  weeks: WeekView[]
  maintenance: Maintenance
  activityLevel: Profile['activity_level']
  eatTarget: number
  goal: Profile['goal']
  today: string
  todayKcal: number | null
  totalFatKg: number
  totalDaysLogged: number
  targetWeightKg: number | null
}

export function DeficitPageClient({
  weeks, maintenance, activityLevel, eatTarget, goal,
  todayKcal, totalFatKg, totalDaysLogged, targetWeightKg,
}: Props) {
  const tdee = maintenance.tdee
  const current = weeks[weeks.length - 1]
  const s = current.summary

  const dailyDeficit = Math.max(0, tdee - eatTarget)
  const impliedPaceKg = dailyDeficit > 0 ? Math.round((dailyDeficit * 7) / 7700 * 100) / 100 : 0

  const statusColor =
    s.status === 'surplus' ? 'var(--bad)'
    : s.status === 'behind' ? 'var(--brand)'
    : 'var(--good)'

  const chartData = useMemo(
    () => weeks.map(w => ({
      label: w.label,
      deficit: w.summary.total_deficit,
      target: w.summary.prorated_target_deficit,
    })),
    [weeks]
  )

  // Scale the day bars off the biggest thing they need to show, with a floor so
  // a quiet week doesn't render one huge bar and six slivers.
  const maxBarH = Math.max(
    dailyDeficit * 1.5,
    600,
    ...current.days.filter(d => d.kcal !== null && d.state === 'done').map(d => Math.abs(tdee - (d.kcal ?? 0)))
  )

  return (
    <div className="space-y-4">

      {/* ── Hero: the plan ── */}
      <div className="rounded-sheet border border-hairline bg-surface bg-hero-wash p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-brand-ink">Your plan</p>

        <div className="mb-4 flex items-baseline gap-2">
          <span className="font-display text-5xl font-bold leading-none tabular-nums text-ink">
            {eatTarget.toLocaleString('en-IN')}
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">kcal / day</p>
            <p className="text-[11px] text-ink-2">to eat each day</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <StatPill label="Maintenance" value={tdee.toLocaleString('en-IN')} unit="kcal" />
          <StatPill label="Daily deficit" value={dailyDeficit.toLocaleString('en-IN')} unit="kcal" highlight />
          <StatPill label="Goal weight" value={targetWeightKg ? formatKg(targetWeightKg) : '—'} unit={targetWeightKg ? 'kg' : ''} />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-[11px] text-ink-2">
            {goal === 'lose' && impliedPaceKg > 0
              ? <>At this pace: <span className="font-semibold text-brand-ink">~{impliedPaceKg} kg/week</span></>
              : goal === 'maintain'
                ? <>Holding steady — no deficit by design.</>
                : <>Eating above maintenance to gain.</>}
          </p>
          <Link href="/settings" className="text-[11px] font-semibold text-brand-ink">Change pace →</Link>
        </div>
      </div>

      {/* ── The explainer: where maintenance comes from ── */}
      <MaintenanceBreakdown maintenance={maintenance} activityLevel={activityLevel} />

      {/* ── This week ── */}
      <div className="rounded-sheet border border-hairline bg-surface p-4 shadow-rest">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-ink-3">This week</p>
          {s.days_logged > 0 && goal !== 'maintain' && (
            <p className="text-xs font-bold" style={{ color: statusColor }}>{s.progress_percent}%</p>
          )}
        </div>

        {s.days_logged === 0 ? (
          <p className="text-[13px] text-ink-2">
            {todayKcal != null
              ? 'Today is still in progress. Your first finished day of the week shows up here tomorrow.'
              : 'Nothing finished yet this week — log a day and it starts building here.'}
          </p>
        ) : (
          <>
            <div className="mb-1 flex items-baseline gap-1.5">
              <span className="font-display text-3xl font-bold leading-none tabular-nums" style={{ color: statusColor }}>
                {Math.abs(s.total_deficit).toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-ink-2">
                kcal {s.total_deficit >= 0 ? 'under' : 'over'} maintenance
              </span>
            </div>
            {s.total_deficit > 0 && (
              <p className="mb-3 text-[11.5px] text-ink-2">
                = <span className="font-semibold text-ink">{Math.round(s.fat_loss_achieved_kg * 1000).toLocaleString('en-IN')} g of fat</span>
                {' '}from {s.days_logged} finished {s.days_logged === 1 ? 'day' : 'days'}
              </p>
            )}

            {goal !== 'maintain' && s.prorated_target_deficit !== 0 && (
              <div className="mb-4">
                <div className="h-2.5 overflow-hidden rounded-full bg-track">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, s.progress_percent)}%`, background: statusColor }}
                  />
                </div>
                <p className="mt-1.5 text-[10.5px] text-ink-3">
                  Measured against {Math.abs(s.prorated_target_deficit).toLocaleString('en-IN')} kcal —
                  your daily target × the {s.days_logged} {s.days_logged === 1 ? 'day' : 'days'} you logged
                  {s.days_unlogged > 0 && `, not the full week (${s.days_unlogged} not logged)`}.
                </p>
              </div>
            )}

            <div className="mb-4">
              <EnergyBar
                maintenance={tdee}
                eaten={tdee - s.average_daily_deficit}
                label="Your average finished day this week"
              />
            </div>
          </>
        )}

        {/* Day bars */}
        <div className="flex h-14 items-end gap-1.5">
          {current.days.map((d, i) => {
            const deficit = d.kcal !== null ? tdee - d.kcal : 0
            const barH = d.state === 'done' ? Math.max(8, Math.round((Math.abs(deficit) / maxBarH) * 100)) : 0
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-0.5">
                <div className="flex h-10 w-full flex-col justify-end">
                  {d.state === 'done' ? (
                    <div
                      style={{ height: `${barH}%`, background: deficit >= 0 ? 'var(--good)' : 'var(--bad)' }}
                      className="w-full rounded-t transition-all duration-500"
                    />
                  ) : d.state === 'today' ? (
                    // In progress: outlined, never filled. A half-eaten day is
                    // not an achievement and must not read like one.
                    <div
                      className="w-full rounded-t border border-dashed"
                      style={{ height: '38%', borderColor: 'var(--brand)', background: 'var(--brand-soft)' }}
                    />
                  ) : (
                    <div className={`h-0.5 w-full rounded-full ${d.state === 'future' ? 'bg-track' : 'bg-hairline'}`} />
                  )}
                </div>
                <p className={`text-[9px] font-bold ${d.state === 'today' ? 'text-brand-ink' : 'text-ink-3'}`}>
                  {DAY_LABELS[i]}
                </p>
              </div>
            )
          })}
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-ink-2">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: 'var(--good)' }} />Under maintenance</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: 'var(--bad)' }} />Over</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm border border-dashed" style={{ borderColor: 'var(--brand)' }} />Today, in progress</span>
        </div>

        {todayKcal != null && (
          <p className="mt-3 border-t border-hairline pt-3 text-[11px] text-ink-3">
            Today so far: <span className="font-semibold tabular-nums text-ink-2">{todayKcal.toLocaleString('en-IN')} kcal</span>.
            It joins the totals once the day is done.
          </p>
        )}

        <p className="mt-3 text-[12px] text-ink-2">{s.insight}</p>
      </div>

      {/* ── 4-week history ── */}
      {chartData.some(d => d.deficit !== 0) && (
        <div className="rounded-sheet border border-hairline bg-surface p-4 shadow-rest">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-3">4-week history</p>
            <p className="text-[10px] text-ink-2">dashed line = that week&apos;s target</p>
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
                      <div className="rounded-control border border-hairline bg-surface px-3 py-2 text-xs shadow-float">
                        <p className="mb-0.5 text-ink-2">week of {label}</p>
                        <p className="font-bold" style={{ color: val > 0 ? 'var(--good)' : 'var(--bad)' }}>
                          {Math.abs(val).toLocaleString('en-IN')} kcal {val > 0 ? 'under' : 'over'}
                        </p>
                        {val > 0 && <p className="text-ink-2">{Math.round(val / 7700 * 1000)} g of fat</p>}
                      </div>
                    )
                  }}
                />
                <ReferenceLine
                  y={weeks[weeks.length - 1]?.summary.target_deficit ?? 0}
                  stroke="var(--brand)" strokeDasharray="4 2" strokeWidth={1.5}
                  label={{ value: 'Goal', position: 'right', fontSize: 9, fill: 'var(--brand)' }}
                />
                <Bar dataKey="deficit" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.target !== 0 && entry.deficit >= entry.target * 0.9 ? 'var(--good)' : entry.deficit > 0 ? 'var(--brand)' : 'var(--bad)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-[10px] text-ink-3">
            Each week is measured against the days you actually logged, so a short week is still a fair week.
          </p>
        </div>
      )}

      {/* ── All time ── */}
      <div className="rounded-sheet border border-hairline bg-surface p-4 shadow-rest">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-ink-3">All time</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-card border border-hairline bg-brand-soft p-3">
            <p className="mb-1 text-[10px] text-ink-2">Total fat burned</p>
            <p className="text-xl font-bold text-brand-ink">{totalFatKg} kg</p>
            <p className="text-[10px] text-ink-2">= {Math.round(totalFatKg * 1000).toLocaleString('en-IN')} g</p>
          </div>
          <div className="rounded-card border border-hairline bg-surface-2 p-3">
            <p className="mb-1 text-[10px] text-ink-2">Days finished</p>
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
    <div className="rounded-card border border-hairline bg-surface px-2.5 py-2 text-center">
      <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-3">{label}</p>
      <p className={`text-sm font-bold leading-tight ${highlight ? 'text-brand-ink' : 'text-ink'}`}>{value}</p>
      {unit && <p className="text-[9px] text-ink-3">{unit}</p>}
    </div>
  )
}
