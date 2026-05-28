'use client'

import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Cell, ReferenceLine } from 'recharts'
import { Moon } from 'lucide-react'
import { useSleepLogs, sleepDurationMin } from '../../hooks/useSleepLogs'
import { useUser } from '../../hooks/useUser'

const TARGET_HOURS = 8
const TARGET_MIN = TARGET_HOURS * 60

function shortDay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3)
}

function fmtDur(min: number): string {
  if (min === 0) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

export function SleepHistoryCard() {
  const { user } = useUser()
  const { history, isLoading } = useSleepLogs(user?.id ?? null)

  // Build a 7-day array
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().slice(0, 10)
    const log = history.find((h) => h.sleep_date === dateStr)
    return {
      date: dateStr,
      label: shortDay(dateStr),
      min: log ? sleepDurationMin(log) : 0,
      quality: log?.quality ?? null,
    }
  })

  const hasData = days.some((d) => d.min > 0)
  const logged = days.filter((d) => d.min > 0)
  const avgMin = logged.length > 0 ? Math.round(logged.reduce((s, d) => s + d.min, 0) / logged.length) : 0
  const metGoal = days.filter((d) => d.min >= TARGET_MIN).length

  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-violet-500" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Sleep · last 7 nights</p>
        </div>
        <p className="text-[11px] font-semibold text-muted">Goal: {TARGET_HOURS}h</p>
      </div>

      {isLoading ? (
        <div className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
      ) : !hasData ? (
        <div className="flex flex-col items-center gap-1 py-5 text-center">
          <Moon className="h-6 w-6 text-violet-200 dark:text-violet-900" />
          <p className="text-xs text-muted">No sleep logged this week</p>
          <p className="text-[11px] text-muted">Log sleep on the Food Diary page</p>
        </div>
      ) : (
        <>
          <div className="h-[100px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days} barSize={24} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <ReferenceLine
                  y={TARGET_MIN} stroke="#7c3aed" strokeDasharray="4 2" strokeWidth={1.5}
                  label={{ value: `${TARGET_HOURS}h`, position: 'right', fontSize: 9, fill: '#7c3aed' }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 4 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const m = payload[0]?.value as number
                    return (
                      <div className="rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 shadow text-xs">
                        <p className="font-bold text-violet-600">{fmtDur(m)}</p>
                        {m > 0 && <p className="text-muted">{m >= TARGET_MIN ? '✅ Goal met' : `${fmtDur(TARGET_MIN - m)} short`}</p>}
                      </div>
                    )
                  }}
                />
                <Bar dataKey="min" radius={[4, 4, 0, 0]}>
                  {days.map((d) => (
                    <Cell
                      key={d.date}
                      fill={d.min === 0 ? '#e2e8f0' : d.min >= TARGET_MIN ? '#7c3aed' : d.min >= 360 ? '#a78bfa' : '#c4b5fd'}
                      className={d.min === 0 ? 'dark:fill-slate-700' : ''}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex gap-2 mt-2 flex-wrap">
            {[
              { label: 'Avg sleep', value: avgMin > 0 ? fmtDur(avgMin) : '—', color: 'text-violet-600 dark:text-violet-400' },
              { label: 'Goal nights', value: `${metGoal} / 7`, color: 'text-violet-600 dark:text-violet-400' },
              { label: 'Best night', value: fmtDur(Math.max(...days.map(d => d.min))), color: 'text-violet-600 dark:text-violet-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-violet-50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 px-3 py-1.5">
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
