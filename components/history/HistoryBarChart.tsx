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

export function HistoryBarChart({
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
    <div className="h-[180px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} barSize={range <= 7 ? 28 : range <= 14 ? 16 : 8}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          {metricTarget > 0 && (
            <ReferenceLine
              y={metricTarget}
              stroke={color}
              strokeDasharray="4 2"
              strokeWidth={1.5}
              label={{ value: 'Goal', position: 'right', fontSize: 9, fill: color }}
            />
          )}
          <Tooltip
            cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 6 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null
              const val = payload[0]?.value as number
              return (
                <div className="rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 shadow-md text-xs">
                  <p className="font-semibold text-muted mb-0.5">{label}</p>
                  <p style={{ color }} className="font-bold">
                    {val > 0 ? `${val.toLocaleString()} ${unit}` : 'Not logged'}
                  </p>
                </div>
              )
            }}
          />
          <Bar
            dataKey={metric}
            radius={[4, 4, 0, 0]}
            onClick={(data: DayData) => onSelect(data.date === selectedDate ? null : data.date)}
            style={{ cursor: 'pointer' }}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.date === selectedDate ? '#9333ea' : entry.kcal === 0 ? 'rgba(100,116,139,0.2)' : color}
                opacity={entry.kcal === 0 ? 1 : entry.date === selectedDate ? 1 : 0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
