'use client'

import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine,
} from 'recharts'
import { format } from 'date-fns'
import type { WeightLog } from '../../types/index'

export function WeightChart({ logs }: { logs: WeightLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="flex h-[200px] w-full items-center justify-center rounded-card border border-dashed border-hairline">
        <p className="text-sm text-ink-2">No entries yet</p>
      </div>
    )
  }

  const data = logs.map((log) => ({
    date: log.measured_at,
    weight: log.weight_kg,
  }))

  const weights = data.map((d) => d.weight)
  const minW = Math.floor(Math.min(...weights) - 1)
  const maxW = Math.ceil(Math.max(...weights) + 1)

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2E7D4F" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#2E7D4F" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={(v) => format(new Date(v), 'MMM d')}
            tick={{ fontSize: 10, fill: '#9AA0A5' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minW, maxW]}
            tick={{ fontSize: 10, fill: '#9AA0A5' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload as { date: string; weight: number }
              return (
                <div className="rounded-control border border-hairline bg-surface px-3 py-2 shadow-float text-xs">
                  <p className="font-semibold text-ink-2">{format(new Date(d.date), 'MMM d, yyyy')}</p>
                  <p className="font-bold text-good tabular-nums">{d.weight} kg</p>
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="weight"
            stroke="#2E7D4F"
            strokeWidth={2.5}
            fill="url(#weightGradient)"
            dot={{ r: 3, fill: '#2E7D4F', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#2E7D4F', strokeWidth: 2, stroke: '#fff' }}
          />
          {data.length > 2 && (
            <ReferenceLine
              y={data[0].weight}
              stroke="#9AA0A5"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
