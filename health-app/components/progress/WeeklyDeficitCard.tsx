import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { WeeklyDeficitSummary } from '../../lib/deficit-calculator'
import { EnergyBar } from './EnergyBar'

const AIR = { boxShadow: 'var(--shadow-air)' } as const

const STATUS_LABEL: Record<WeeklyDeficitSummary['status'], string> = {
  ahead: 'Ahead',
  on_track: 'On track',
  behind: 'Building',
  surplus: 'Over',
}

/**
 * "How much of a deficit have I been in this week?" — answered on the tab the
 * user already opens to ask it.
 *
 * Every number here comes from `calculateWeeklyDeficit`, which is also what
 * `/deficit` renders. That shared source is the point: the two screens used to
 * disagree about the same word on cards that link to each other.
 */
export function WeeklyDeficitCard({
  summary,
  maintenance,
  goal,
  todayKcal,
}: {
  summary: WeeklyDeficitSummary
  maintenance: number
  goal: 'lose' | 'maintain' | 'gain'
  /** Today's running total. Shown, never counted. */
  todayKcal: number | null
}) {
  const {
    total_deficit, days_logged, days_unlogged, progress_percent,
    average_daily_deficit, fat_loss_achieved_kg, status, insight,
  } = summary

  const statusColor =
    status === 'surplus' ? 'var(--bad)'
    : status === 'behind' ? 'var(--brand)'
    : 'var(--good)'

  // Never render a bare negative — "600 kcal above maintenance" reads as
  // information, "-600 kcal" reads as a failing grade.
  const magnitude = Math.abs(total_deficit)
  const under = total_deficit >= 0
  const fatGrams = Math.round(fat_loss_achieved_kg * 1000)

  if (days_logged === 0) {
    return (
      <Link href="/deficit" className="mt-3 block rounded-[24px] bg-surface px-5 py-[18px] tap-scale" style={AIR}>
        <p className="text-[12px] text-ink-3">This week</p>
        <p className="mt-1.5 text-[14px] text-ink">
          {todayKcal != null
            ? 'Today is still in progress — your first full day lands here tomorrow.'
            : 'Log a day and your weekly deficit starts building here.'}
        </p>
        <p className="mt-2.5 flex items-center gap-1 text-[12px] font-semibold text-brand-ink">
          How maintenance works <ChevronRight className="h-3.5 w-3.5" />
        </p>
      </Link>
    )
  }

  return (
    <Link href="/deficit" className="mt-3 block rounded-[24px] bg-surface p-5 tap-scale" style={AIR}>
      <div className="flex items-baseline justify-between">
        <p className="text-[12px] text-ink-3">This week</p>
        <p className="text-[11px] font-bold" style={{ color: statusColor }}>{STATUS_LABEL[status]}</p>
      </div>

      {/* The headline: what the week added up to. */}
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span
          className="font-display text-[32px] font-bold leading-none tabular-nums"
          style={{ letterSpacing: '-0.02em', color: statusColor }}
        >
          {magnitude.toLocaleString('en-IN')}
        </span>
        <span className="text-[12px] text-ink-2">kcal {under ? 'under' : 'over'} maintenance</span>
      </div>

      {under && fatGrams > 0 && (
        <p className="mt-1 text-[12px] text-ink-2">
          That is <span className="font-semibold text-ink">{fatGrams.toLocaleString('en-IN')} g of fat</span>
          {' '}— {days_logged} logged {days_logged === 1 ? 'day' : 'days'} of work.
        </p>
      )}

      {/* Progress against a target scaled to the days actually logged, so a
          partial week is winnable rather than permanently "behind". */}
      {goal !== 'maintain' && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-track">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, progress_percent)}%`, background: statusColor }}
            />
          </div>
          <div className="mt-1.5 flex items-baseline justify-between">
            <p className="text-[11px] text-ink-3">
              {days_logged} of {days_logged + days_unlogged} {days_logged + days_unlogged === 1 ? 'day' : 'days'} logged
              {days_unlogged > 0 && ` · ${days_unlogged} not logged`}
            </p>
            <p className="text-[11px] font-bold tabular-nums" style={{ color: statusColor }}>
              {progress_percent}%
            </p>
          </div>
        </div>
      )}

      {/* The mechanism, on an average day. */}
      <div className="mt-4 border-t border-hairline pt-4">
        <EnergyBar
          maintenance={maintenance}
          eaten={maintenance - average_daily_deficit}
          label="Your average logged day this week"
        />
      </div>

      {todayKcal != null && (
        <p className="mt-3 text-[11px] text-ink-3">
          Today: <span className="font-semibold tabular-nums text-ink-2">{todayKcal.toLocaleString('en-IN')} kcal</span> so far —
          still in progress, so it is not counted above.
        </p>
      )}

      <p className="mt-3 text-[12px] text-ink-2">{insight}</p>

      <p className="mt-2.5 flex items-center gap-1 text-[12px] font-semibold text-brand-ink">
        How maintenance works <ChevronRight className="h-3.5 w-3.5" />
      </p>
    </Link>
  )
}
