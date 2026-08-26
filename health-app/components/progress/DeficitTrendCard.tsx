'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, Lock } from 'lucide-react'
import type { WeeklyDeficitSummary } from '../../lib/deficit-calculator'
import { CumulativeDeficitChart, type DeficitPoint } from './CumulativeDeficitChart'

const AIR = { boxShadow: 'var(--shadow-air)' } as const

const STATUS_LABEL: Record<WeeklyDeficitSummary['status'], string> = {
  ahead: 'Ahead',
  on_track: 'On track',
  behind: 'Building',
  surplus: 'Over',
}

export type DeficitPeriodView = {
  kind: 'week' | 'month'
  /** "Last 7 days", "Previous 30 days" — whatever the numbers actually describe. */
  label: string
  summary: WeeklyDeficitSummary
  points: DeficitPoint[]
  /** Today's running total. Shown, never counted. */
  todayKcal: number | null
  /** True when nothing has finished in the current period, so we show the last one. */
  isFallback: boolean
}

/**
 * "How much of a deficit have I been in?" — answered in three beats and nothing
 * else: the number, what it is worth in fat, and the days that built it.
 *
 * The first version of this card carried six ideas at once (a total, a fat figure,
 * a percentage, a day count, an average-day bar, today's partial, and a coaching
 * line) and read as noise. Everything explanatory now lives on `/deficit`; this
 * card answers, it does not teach.
 */
export function DeficitTrendCard({
  week,
  month,
  goal,
  isPro,
}: {
  week: DeficitPeriodView
  /** Null for free accounts — the month is Pro, and the gate is server-side. */
  month: DeficitPeriodView | null
  goal: 'lose' | 'maintain' | 'gain'
  isPro: boolean
}) {
  const [kind, setKind] = useState<'week' | 'month'>('week')
  const view = kind === 'month' && month ? month : week
  const { summary: s, points, todayKcal, isFallback, label } = view

  const statusColor =
    s.status === 'surplus' ? 'var(--bad)'
    : s.status === 'behind' ? 'var(--brand)'
    : 'var(--good)'

  // Never render a bare negative — "600 kcal above maintenance" reads as
  // information, "-600 kcal" reads as a failing grade.
  const magnitude = Math.abs(s.total_deficit)
  const under = s.total_deficit >= 0

  // Grams while the number is small enough to feel concrete; kilos once it isn't.
  const fatKg = s.fat_loss_achieved_kg
  const fatLabel = fatKg >= 1
    ? `${fatKg.toFixed(2)} kg`
    : `${Math.round(fatKg * 1000).toLocaleString('en-IN')} g`

  const daysInWindow = s.days_logged + s.days_unlogged

  return (
    <div className="mt-3 rounded-card-lg bg-surface p-5" style={AIR}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-caption font-semibold text-ink">Calorie deficit</p>
        <PeriodToggle kind={kind} onChange={setKind} monthUnlocked={!!month} isPro={isPro} />
      </div>

      {s.days_logged === 0 ? (
        <p className="mt-2.5 text-caption text-ink-2">
          {todayKcal != null
            ? 'Today is still in progress — your first full day lands here tomorrow.'
            : 'Log a day and your deficit starts building here.'}
        </p>
      ) : (
        <>
          {/* Beat 1 — the number. */}
          <div className="mt-2.5 flex items-baseline justify-between gap-2">
            <p className="text-micro text-ink-3">{label}</p>
            <p className="text-micro font-bold" style={{ color: statusColor }}>
              {STATUS_LABEL[s.status]}
            </p>
          </div>

          <div className="mt-1 flex items-baseline gap-1.5">
            <span
              className="font-display text-display font-bold leading-none tabular-nums"
              style={{ color: statusColor }}
            >
              {magnitude.toLocaleString('en-IN')}
            </span>
            <span className="text-caption text-ink-2">
              kcal {under ? 'under' : 'over'} maintenance
            </span>
          </div>

          {/* Beat 2 — what it is worth. */}
          {under && fatKg > 0 && (
            <p className="mt-1 text-caption text-ink-2">
              That&apos;s <span className="font-semibold text-ink">{fatLabel} of fat</span>.
            </p>
          )}

          {/* Beat 3 — the days that built it. */}
          {points.length >= 2 && (
            <div className="mt-3.5">
              <CumulativeDeficitChart
                points={points}
                color={statusColor}
                showTarget={goal !== 'maintain'}
              />
            </div>
          )}

          <p className="mt-2.5 text-micro text-ink-3">
            {s.days_logged} of {daysInWindow} {daysInWindow === 1 ? 'day' : 'days'} logged
            {s.days_unlogged > 0 && ` · ${s.days_unlogged} not logged`}
            {isFallback
              ? ` · nothing finished this ${kind} yet`
              : todayKcal != null
                ? ` · today's ${todayKcal.toLocaleString('en-IN')} kcal not counted yet`
                : ''}
          </p>

          <p className="mt-2 text-caption text-ink-2">{s.insight}</p>
        </>
      )}

      <Link
        href="/deficit"
        className="mt-3 flex items-center gap-1 text-caption font-semibold text-brand-ink tap-scale"
      >
        How maintenance works <ChevronRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

/**
 * Week is free; the month is Pro, matching the locked 14/30-day trend ranges.
 * The lock is only the rendering of a null the server already withheld — a free
 * client never receives month numbers to reveal.
 */
function PeriodToggle({
  kind, onChange, monthUnlocked, isPro,
}: {
  kind: 'week' | 'month'
  onChange: (k: 'week' | 'month') => void
  monthUnlocked: boolean
  isPro: boolean
}) {
  const base = 'rounded-full px-2.5 py-1 text-micro font-semibold transition-all'

  return (
    <div className="flex gap-1 rounded-full bg-surface-2 p-0.5">
      <button
        type="button"
        onClick={() => onChange('week')}
        className={`${base} ${kind === 'week' ? 'bg-surface text-ink' : 'text-ink-3'}`}
        style={kind === 'week' ? AIR : undefined}
      >
        Week
      </button>

      {monthUnlocked ? (
        <button
          type="button"
          onClick={() => onChange('month')}
          className={`${base} ${kind === 'month' ? 'bg-surface text-ink' : 'text-ink-3'}`}
          style={kind === 'month' ? AIR : undefined}
        >
          Month
        </button>
      ) : (
        <Link
          href="/upgrade?reason=history"
          aria-label={isPro ? 'Month view' : 'Month view — upgrade to Pro'}
          className={`${base} flex items-center gap-1 text-ink-3 opacity-70`}
        >
          <Lock className="h-2.5 w-2.5" /> Month
        </Link>
      )}
    </div>
  )
}
