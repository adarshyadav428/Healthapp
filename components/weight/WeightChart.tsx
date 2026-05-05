'use client'

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { format } from 'date-fns'
import type { WeightLog } from '../../types/index'

function movingAverage(data: { date: string; weight: number }[], windowSize = 14) {
  return data.map((point, idx) => {
    const start = Math.max(0, idx - windowSize + 1)
    const slice = data.slice(start, idx + 1)
    const avg = slice.reduce((acc, cur) => acc + cur.weight, 0) / slice.length
    return { ...point, trend: Number(avg.toFixed(2)) }
  })
}

export function WeightChart({ logs }: { logs: WeightLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="flex h-[250px] w-full items-center justify-center rounded-xl border border-dashed border-gray-200">
        <p className="text-sm text-gray-400">No weight entries yet. Log your first weight to see your chart.</p>
      </div>
    )
  }

  const data = logs
    .slice()
    .reverse()
    .map((log) => ({ date: log.measured_at, weight: log.weight_kg }))

  const withTrend = movingAverage(data)

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={withTrend}>
          <XAxis dataKey="date" tickFormatter={(value) => format(new Date(value), 'MMM d')} />
          <YAxis dataKey="weight" />
          <Tooltip labelFormatter={(value) => format(new Date(String(value)), 'MMM d, yyyy')} />
          <Line type="monotone" dataKey="weight" stroke="#2563eb" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="trend" stroke="#94a3b8" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
