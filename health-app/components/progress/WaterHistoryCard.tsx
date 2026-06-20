'use client'

import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { Droplets } from 'lucide-react'
import { useUser } from '../../hooks/useUser'

type DayWater = { date: string; ml: number }

function shortLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3)
}

export function WaterHistoryCard({ targetMl }: { targetMl: number }) {
  const { user } = useUser()

  const { data, isLoading } = useQuery<DayWater[]>({
    queryKey: ['water-history', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const res = await fetch('/api/water/history')
      if (!res.ok) return []
      return res.json()
    },
  })

  const today = new Date().toISOString().slice(0, 10)
  const days = data ?? []
  const hasAnyData = days.some((d) => d.ml > 0)

  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-sky-500" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Water · last 7 days</p>
        </div>
        <p className="text-[11px] font-semibold text-muted">Goal: {(targetMl / 1000).toFixed(1)} L</p>
      </div>

      {isLoading ? (
        <div className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
      ) : !hasAnyData ? (
        <div className="flex flex-col items-center gap-1 py-5 text-center">
          <Droplets className="h-6 w-6 text-sky-200 dark:text-sky-900" />
          <p className="text-xs text-muted">No water logged yet this week</p>
        </div>
      ) : (
        <>
          <div className="h-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days} barSize={24} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={shortLabel}
                  tick={{ fontSize: 10, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 4 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const ml = payload[0]?.value as number
                    return (
                      <div className="rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 shadow text-xs">
                        <p className="font-bold text-sky-600">{ml >= 1000 ? `${(ml / 1000).toFixed(1)} L` : `${ml} ml`}</p>
                        {targetMl > 0 && <p className="text-muted">{Math.round((ml / targetMl) * 100)}% of goal</p>}
                      </div>
                    )
                  }}
                />
                <Bar dataKey="ml" radius={[4, 4, 0, 0]}>
                  {days.map((d) => {
                    const met = d.ml >= targetMl
                    const isToday = d.date === today
                    return (
                      <Cell
                        key={d.date}
                        fill={d.ml === 0 ? '#e2e8f0' : met ? '#0ea5e9' : isToday ? '#38bdf8' : '#7dd3fc'}
                        className={d.ml === 0 ? 'dark:fill-slate-700' : ''}
                      />
                    )
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary row */}
          <div className="flex gap-3 mt-2 flex-wrap">
            {[
              { label: 'Days met', value: `${days.filter((d) => d.ml >= targetMl).length} / 7`, color: 'text-sky-600 dark:text-sky-400' },
              { label: 'Best day', value: (() => { const best = Math.max(...days.map(d => d.ml)); return best > 0 ? (best >= 1000 ? `${(best/1000).toFixed(1)} L` : `${best} ml`) : '—' })(), color: 'text-sky-600 dark:text-sky-400' },
              { label: 'Today', value: (() => { const t = days.find(d => d.date === today)?.ml ?? 0; return t >= 1000 ? `${(t/1000).toFixed(1)} L` : `${t} ml` })(), color: 'text-sky-600 dark:text-sky-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-sky-50 dark:bg-sky-950/20 border border-sky-100 dark:border-sky-900/30 px-3 py-1.5">
                <p className="text-[10px] text-muted">{label}</p>
                <p className={`text-sm font-black ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
