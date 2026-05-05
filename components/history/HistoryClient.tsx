'use client'

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine, Cell,
} from 'recharts'
import type { Profile } from '../../types/index'
import { format, parseISO, startOfDay, subDays, eachDayOfInterval } from 'date-fns'

type LogRow = {
  logged_at: string
  kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  meal: string
}

type DayData = {
  date: string
  label: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  logged: boolean
}

const RANGES = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
]

export function HistoryClient({ logs, profile }: { logs: LogRow[]; profile: Profile }) {
  const [range, setRange] = useState(14)
  const [metric, setMetric] = useState<'kcal' | 'protein' | 'carbs' | 'fat'>('kcal')
  const target = profile.daily_calorie_target

  const chartData: DayData[] = useMemo(() => {
    const today = startOfDay(new Date())
    const days = eachDayOfInterval({ start: subDays(today, range - 1), end: today })

    const byDay = new Map<string, { kcal: number; protein: number; carbs: number; fat: number }>()
    for (const log of logs) {
      const key = format(startOfDay(parseISO(log.logged_at)), 'yyyy-MM-dd')
      const existing = byDay.get(key) ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 }
      byDay.set(key, {
        kcal: existing.kcal + log.kcal,
        protein: existing.protein + log.protein_g,
        carbs: existing.carbs + log.carbs_g,
        fat: existing.fat + log.fat_g,
      })
    }

    return days.map((day) => {
      const key = format(day, 'yyyy-MM-dd')
      const data = byDay.get(key)
      const isToday = key === format(today, 'yyyy-MM-dd')
      return {
        date: key,
        label: range <= 7 ? format(day, 'EEE') : format(day, 'MMM d'),
        kcal: Math.round(data?.kcal ?? 0),
        protein: Math.round(data?.protein ?? 0),
        carbs: Math.round(data?.carbs ?? 0),
        fat: Math.round(data?.fat ?? 0),
        logged: !!data && !isToday,
      }
    })
  }, [logs, range])

  const loggedDays = chartData.filter((d) => d.kcal > 0)
  const avgKcal = loggedDays.length > 0 ? Math.round(loggedDays.reduce((s, d) => s + d.kcal, 0) / loggedDays.length) : 0
  const avgProtein = loggedDays.length > 0 ? Math.round(loggedDays.reduce((s, d) => s + d.protein, 0) / loggedDays.length) : 0
  const avgCarbs = loggedDays.length > 0 ? Math.round(loggedDays.reduce((s, d) => s + d.carbs, 0) / loggedDays.length) : 0
  const avgFat = loggedDays.length > 0 ? Math.round(loggedDays.reduce((s, d) => s + d.fat, 0) / loggedDays.length) : 0

  const streakCount = useMemo(() => {
    const today = format(startOfDay(new Date()), 'yyyy-MM-dd')
    const loggedSet = new Set(logs.map((l) => format(startOfDay(parseISO(l.logged_at)), 'yyyy-MM-dd')))
    let streak = 0
    let current = new Date()
    // Check today first, if not logged start from yesterday
    if (!loggedSet.has(format(current, 'yyyy-MM-dd'))) {
      current = subDays(current, 1)
    }
    while (loggedSet.has(format(current, 'yyyy-MM-dd'))) {
      streak++
      current = subDays(current, 1)
    }
    void today
    return streak
  }, [logs])

  const metricConfig = {
    kcal: { color: '#ea580c', label: 'Calories', unit: 'kcal' },
    protein: { color: '#3b82f6', label: 'Protein', unit: 'g' },
    carbs: { color: '#f59e0b', label: 'Carbs', unit: 'g' },
    fat: { color: '#ef4444', label: 'Fat', unit: 'g' },
  }

  const cfg = metricConfig[metric]

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Avg daily calories"
          value={avgKcal > 0 ? `${avgKcal.toLocaleString()}` : '--'}
          unit="kcal"
          sub={target > 0 && avgKcal > 0 ? `Goal: ${target.toLocaleString()}` : undefined}
          color="text-orange-600"
          bg="bg-orange-50 border-orange-100"
        />
        <StatCard
          label="Days logged"
          value={String(loggedDays.length)}
          unit={`of ${range}`}
          sub={streakCount > 0 ? `🔥 ${streakCount} day streak` : undefined}
          color="text-emerald-600"
          bg="bg-emerald-50 border-emerald-100"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <MacroCard label="Avg protein" value={avgProtein} unit="g" color="text-blue-600" />
        <MacroCard label="Avg carbs" value={avgCarbs} unit="g" color="text-amber-600" />
        <MacroCard label="Avg fat" value={avgFat} unit="g" color="text-rose-600" />
      </div>

      {/* Chart card */}
      <div className="rounded-3xl border border-gray-100 bg-white/90 p-4 shadow-sm">
        {/* Range tabs */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{cfg.label} trend</p>
          <div className="flex gap-1 rounded-xl bg-gray-100 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                onClick={() => setRange(r.days)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  range === r.days ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Metric tabs */}
        <div className="flex gap-1.5 mb-4">
          {(Object.keys(metricConfig) as Array<keyof typeof metricConfig>).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={`rounded-xl px-3 py-1 text-xs font-semibold transition-all ${
                metric === m
                  ? 'text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
              style={metric === m ? { backgroundColor: metricConfig[m].color } : {}}
            >
              {metricConfig[m].label}
            </button>
          ))}
        </div>

        {/* Bar chart */}
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
              {metric === 'kcal' && target > 0 && (
                <ReferenceLine
                  y={target}
                  stroke="#ea580c"
                  strokeDasharray="4 2"
                  strokeWidth={1.5}
                  label={{ value: 'Goal', position: 'right', fontSize: 9, fill: '#ea580c' }}
                />
              )}
              <Tooltip
                cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 6 }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const val = payload[0]?.value as number
                  return (
                    <div className="rounded-xl border border-gray-100 bg-white px-3 py-2 shadow-md text-xs">
                      <p className="font-semibold text-gray-600 mb-0.5">{label}</p>
                      <p style={{ color: cfg.color }} className="font-bold">
                        {val > 0 ? `${val.toLocaleString()} ${cfg.unit}` : 'Not logged'}
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey={metric} radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.kcal === 0 ? '#f3f4f6' : cfg.color}
                    opacity={entry.kcal === 0 ? 1 : 0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="mt-2 text-[10px] text-gray-400 text-center">
          Grey bars = days with no logs
        </p>
      </div>

      {/* Weekly breakdown */}
      {loggedDays.length > 0 && (
        <div className="rounded-3xl border border-gray-100 bg-white/90 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Calorie breakdown by day</p>
          <div className="space-y-2">
            {[...chartData].reverse().slice(0, 7).map((day) => {
              const pct = target > 0 ? Math.min((day.kcal / target) * 100, 100) : 0
              const color = day.kcal === 0 ? 'bg-gray-200' : day.kcal > target * 1.1 ? 'bg-rose-400' : day.kcal >= target * 0.9 ? 'bg-emerald-400' : 'bg-orange-400'
              return (
                <div key={day.date} className="flex items-center gap-3">
                  <span className="w-14 text-xs text-gray-500 font-medium shrink-0">{day.label}</span>
                  <div className="flex-1 h-5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${color}`}
                      style={{ width: day.kcal === 0 ? '0%' : `${pct}%` }}
                    />
                  </div>
                  <span className="w-16 text-xs font-bold text-gray-700 text-right shrink-0">
                    {day.kcal > 0 ? `${day.kcal.toLocaleString()} kcal` : '—'}
                  </span>
                </div>
              )
            })}
          </div>
          {target > 0 && (
            <div className="mt-3 flex items-center gap-3 text-[10px] text-gray-400">
              <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" /> On target</div>
              <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-400 inline-block" /> Under target</div>
              <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400 inline-block" /> Over target</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({
  label, value, unit, sub, color, bg,
}: {
  label: string; value: string; unit?: string; sub?: string; color: string; bg: string
}) {
  return (
    <div className={`rounded-2xl border p-3.5 ${bg}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={`text-2xl font-black ${color}`}>{value}</span>
        {unit && <span className="text-xs text-gray-400">{unit}</span>}
      </div>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function MacroCard({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white/90 p-3 text-center shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-lg font-black mt-0.5 ${color}`}>{value > 0 ? value : '--'}</p>
      <p className="text-[10px] text-gray-400">{unit}</p>
    </div>
  )
}
