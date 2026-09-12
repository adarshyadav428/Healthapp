'use client'

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine, Cell } from 'recharts'

type DayData = {
  date: string
  label: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  logged: boolean
}

export function TrendBarChart({
  chartData, range, metric, metricTarget, color, unit, selectedDate, onSelect,
}: {
  chartData: DayData[]
  range: number
  metric: 'kcal' | 'protein' | 'carbs' | 'fat'
  metricTarget: number
  color: string
  unit: string
  selectedDate: string | null
  onSelect: (date: string | null) => void
}) {
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barSize={range <= 7 ? 24 : range <= 14 ? 14 : 7} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`bar-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="100%" stopColor={color} stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--ink-3)' }}
            axisLine={false}
            tickLine={false}
            interval={range <= 7 ? 0 : range <= 14 ? 1 : 4}
          />
          <YAxis hide />
          {metricTarget > 0 && (
            <ReferenceLine
              y={metricTarget}
              stroke="var(--ink-3)"
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          )}
          <Tooltip
            cursor={{ fill: 'var(--surface-2)', radius: 6 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const val = payload[0]?.value as number
              return (
                <div className="rounded-control border border-hairline bg-surface px-3 py-2 shadow-float">
                  <p className="text-micro font-medium text-ink-3">{label}</p>
                  <p className="text-body font-semibold tabular-nums text-ink">
                    {val > 0 ? `${val.toLocaleString()} ${unit}` : 'Not logged'}
                  </p>
                </div>
              )
            }}
          />
          <Bar
            dataKey={metric}
            radius={[6, 6, 6, 6]}
            isAnimationActive={false}
            onClick={(data: DayData) => onSelect(data.date === selectedDate ? null : data.date)}
            style={{ cursor: 'pointer' }}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.date === selectedDate ? 'var(--ink)' : entry.kcal === 0 ? 'var(--surface-2)' : `url(#bar-${metric})`}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
