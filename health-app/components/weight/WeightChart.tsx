'use client'

import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine,
} from 'recharts'
import type { WeightLog } from '../../types/index'
import { formatIst } from '../../lib/dateUtils'

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
              <stop offset="5%" stopColor="var(--good)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--good)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={(v) => formatIst(v, { month: 'short', day: 'numeric' }, 'en-US')}
            tick={{ fontSize: 10, fill: 'var(--ink-3)' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minW, maxW]}
            tick={{ fontSize: 10, fill: 'var(--ink-3)' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0]?.payload as { date: string; weight: number }
              return (
                <div className="rounded-control border border-hairline bg-surface px-3 py-2 shadow-float text-xs">
                  <p className="font-semibold text-ink-2">{formatIst(d.date, { month: 'short', day: 'numeric', year: 'numeric' }, 'en-US')}</p>
                  <p className="font-bold text-good tabular-nums">{d.weight} kg</p>
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="weight"
            stroke="var(--good)"
            strokeWidth={2.5}
            fill="url(#weightGradient)"
            dot={{ r: 3, fill: 'var(--good)', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: 'var(--good)', strokeWidth: 2, stroke: 'var(--surface)' }}
          />
          {data.length > 2 && (
            <ReferenceLine
              y={data[0].weight}
              stroke="var(--ink-3)"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
