'use client'

import { ComposedChart, Area, Scatter, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts'
import type { TrendPoint } from '../../lib/weightTrend'
import { formatIst } from '../../lib/dateUtils'

// `TrendPoint.date` is a UTC day key. Noon UTC of that day is 17:30 IST on the
// same calendar day, so formatting it in IST can never slip a day.
const labelFor = (date: string) => formatIst(`${date}T12:00:00Z`, { month: 'short', day: 'numeric' }, 'en-US')

/**
 * The weight picture: every weigh-in as a quiet dot, the 4-week average as the
 * one line, the goal as a dashed rule. The dots are there so the line reads as
 * *derived from* the scale rather than instead of it — a user who just saw
 * 73.1 on the bathroom scale should be able to find that morning on the chart.
 */
export function WeightTrendChart({ points, targetKg, hasTrend }: {
  points: TrendPoint[]
  targetKg: number | null
  /** False below MIN_DAYS_FOR_TREND — the average is then drawn faint, not asserted. */
  hasTrend: boolean
}) {
  // The axis fits the weigh-ins. The goal line is drawn only when it is near
  // enough to share the picture — a goal 10 kg away would squash a month of
  // real movement into a flat line at the top of the chart.
  const values = points.flatMap((p) => [p.raw, p.average])
  const dataMin = Math.min(...values)
  const dataMax = Math.max(...values)
  const goalNear = targetKg != null && targetKg >= dataMin - 2 && targetKg <= dataMax + 2
  if (goalNear) values.push(targetKg!)
  const min = Math.floor(Math.min(...values) - 0.5)
  const max = Math.ceil(Math.max(...values) + 0.5)

  const tickInterval = points.length > 8 ? Math.ceil(points.length / 5) : 0

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 16 }}>
          <defs>
            <linearGradient id="weightWash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={labelFor}
            tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
            axisLine={false}
            tickLine={false}
            interval={tickInterval}
          />
          <YAxis domain={[min, max]} hide />

          {goalNear && (
            <ReferenceLine
              y={targetKg!}
              stroke="var(--ink-3)"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: `Goal ${targetKg} kg`, position: 'insideTopRight', fill: 'var(--ink-3)', fontSize: 10, offset: 6 }}
            />
          )}

          <Tooltip
            cursor={{ stroke: 'var(--hairline)', strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload as TrendPoint
              return (
                <div className="rounded-control border border-hairline bg-surface px-3 py-2 shadow-float">
                  <p className="text-micro font-medium text-ink-3">{labelFor(d.date)}</p>
                  <p className="text-body font-semibold tabular-nums text-ink">{d.raw} kg</p>
                  {hasTrend && <p className="text-micro tabular-nums text-ink-2">avg {d.average} kg</p>}
                </div>
              )
            }}
          />

          <Area
            type="monotone"
            dataKey="average"
            stroke="var(--brand)"
            strokeWidth={hasTrend ? 2.5 : 1.5}
            strokeOpacity={hasTrend ? 1 : 0.55}
            fill="url(#weightWash)"
            dot={false}
            activeDot={{ r: 5, fill: 'var(--brand)', strokeWidth: 2, stroke: 'var(--surface)' }}
            isAnimationActive={false}
          />
          {/* Dots after the wash so they sit on top of it. */}
          <Scatter dataKey="raw" fill="var(--ink-2)" opacity={0.75} shape="circle" r={2.5} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
