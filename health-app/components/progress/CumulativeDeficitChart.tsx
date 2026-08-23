'use client'

// ComposedChart, not AreaChart: an <Area> and a <Line> have to coexist here, and
// AreaChart silently drops the Line rather than erroring.
import {
  ComposedChart, Area, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip,
} from 'recharts'
import { KCAL_PER_KG_FAT } from '../../lib/tdee'

export type DeficitPoint = {
  /** Axis label — a weekday initial, or a date in a month. */
  label: string
  /** Running total of (maintenance − eaten) up to and including this day. */
  cumulative: number
  /** Where the plan says the running total should be by this day. */
  target: number
}

/**
 * The whole feature in one picture: a total that climbs by (maintenance − eaten)
 * each day, against the pace the plan asks for.
 *
 * Two deliberate choices:
 *
 *  - **The gridlines are the formula.** They sit at multiples of 7,700 kcal and
 *    are labelled in kg, so "1 kg of fat = 7,700 kcal" is read off the axis
 *    rather than asserted in a caption. Nothing else has to explain the rule.
 *  - **It accumulates rather than scores.** A heavy day bends the line down but
 *    cannot erase the days before it — which is the honest shape of fat loss, and
 *    the opposite of what a per-day report card implies.
 */
export function CumulativeDeficitChart({
  points,
  color,
  showTarget = true,
}: {
  points: DeficitPoint[]
  /** Matches the card's status colour so the chart and the headline agree. */
  color: string
  /** Hidden for a maintain goal, where a pace line at zero says nothing. */
  showTarget?: boolean
}) {
  // Start the line on the axis: day one should read as a climb from nothing, not
  // as a value that was already there.
  const data = [{ label: '', cumulative: 0, target: 0 }, ...points]

  const values = data.flatMap((d) => (showTarget ? [d.cumulative, d.target] : [d.cumulative]))
  const peak = Math.max(...values, 0)
  const trough = Math.min(...values, 0)

  // Round the ceiling up to a whole kilo so there is always a labelled kg line
  // above the data — a visible next milestone rather than a line that stops at
  // wherever the user happens to be.
  const topKg = Math.max(1, Math.ceil(peak / KCAL_PER_KG_FAT))
  const domainMax = topKg * KCAL_PER_KG_FAT
  const domainMin = trough < 0 ? Math.floor(trough / 1000) * 1000 : 0

  // Above ~5 kilos the labels would collide on a phone, so thin them out.
  const kgStep = topKg > 5 ? 2 : 1
  const kgLines: number[] = []
  for (let k = kgStep; k <= topKg; k += kgStep) kgLines.push(k)

  // A month has too many days to label every one.
  const tickInterval = points.length > 10 ? Math.ceil(points.length / 6) : 0

  return (
    <div className="h-[164px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="deficitClimb" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <YAxis domain={[domainMin, domainMax]} hide />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            interval={tickInterval}
            tick={{ fontSize: 10, fill: 'var(--ink-3)' }}
          />

          {/* Maintenance-neutral. Only worth drawing once something dips below it. */}
          {domainMin < 0 && (
            <ReferenceLine y={0} stroke="var(--ink-3)" strokeWidth={1} />
          )}

          {/* The 7,700 rule, as the grid. */}
          {kgLines.map((k) => (
            <ReferenceLine
              key={k}
              y={k * KCAL_PER_KG_FAT}
              stroke="var(--hairline)"
              strokeWidth={1}
              label={{
                value: `${k} kg`,
                position: 'insideTopLeft',
                fill: 'var(--ink-3)',
                fontSize: 9,
                offset: 4,
              }}
            />
          ))}

          <Tooltip
            cursor={{ stroke: 'var(--hairline)', strokeWidth: 1 }}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--hairline)',
              borderRadius: 12,
              fontSize: 11,
              color: 'var(--ink)',
              boxShadow: 'var(--shadow-air)',
            }}
            labelStyle={{ color: 'var(--ink-3)', fontSize: 10 }}
            formatter={(value: number, name: string) => [
              `${Math.round(value).toLocaleString('en-IN')} kcal`,
              name === 'cumulative' ? 'You' : 'Plan',
            ]}
          />

          {/* The plan's pace — a straight climb, so being above it reads as ahead. */}
          {showTarget && (
            <Line
              type="linear"
              dataKey="target"
              stroke="var(--ink-3)"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              isAnimationActive={false}
            />
          )}

          <Area
            type="monotone"
            dataKey="cumulative"
            stroke={color}
            strokeWidth={2.5}
            fill="url(#deficitClimb)"
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
