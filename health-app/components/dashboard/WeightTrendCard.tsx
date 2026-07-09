'use client'

import { LineChart, Line, ResponsiveContainer } from 'recharts'
import type { WeightLog } from '../../types/index'

export function WeightTrendCard({ logs }: { logs: WeightLog[] }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-emerald-200 bg-white/80 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Weight</p>
        <p className="mt-2 text-xs text-muted">Log your weight to see the trend.</p>
      </div>
    )
  }

  const sorted = logs
    .slice()
    .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime())

  const data = sorted.map((log) => ({ weight: log.weight_kg }))
  const current = data[data.length - 1]?.weight ?? 0
  const start = data[0]?.weight ?? current
  const delta = Number((current - start).toFixed(1))
  const deltaLabel = delta <= 0 ? `${Math.abs(delta)} kg ↓` : `${delta} kg ↑`
  const deltaColor = delta <= 0 ? 'text-emerald-600' : 'text-rose-600'

  return (
    <div className="rounded-3xl border border-emerald-100 bg-white/90 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Weight</p>
          <p className="mt-1 text-2xl font-black text-foreground leading-none">{current} kg</p>
          <p className={`text-xs font-semibold mt-0.5 ${deltaColor}`}>{deltaLabel}</p>
        </div>
        <span className="text-xl">⚖️</span>
      </div>
      <div className="mt-3 h-16">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line type="monotone" dataKey="weight" stroke="#059669" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
