'use client'

type WeekLog = { kcal: number; logged_at: string }

type WeeklySummaryProps = {
  weekLogs: WeekLog[]
  kcalTarget: number | null
}

type DayData = {
  date: string
  label: string
  kcal: number
  logged: boolean
  isToday: boolean
}

export function WeeklySummary({ weekLogs, kcalTarget }: WeeklySummaryProps) {
  // Build last 7 days (oldest → today)
  const days: DayData[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    const label = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][d.getUTCDay()]
    days.push({ date: dateStr, label, kcal: 0, logged: false, isToday: i === 0 })
  }

  for (const log of weekLogs) {
    const day = days.find((d) => d.date === log.logged_at.slice(0, 10))
    if (day) { day.kcal += log.kcal; day.logged = true }
  }

  const daysLogged = days.filter((d) => d.logged).length
  const totalKcal = Math.round(days.reduce((sum, d) => sum + d.kcal, 0))
  const avgKcal = daysLogged > 0 ? Math.round(totalKcal / daysLogged) : 0
  const deficit = kcalTarget && avgKcal > 0 ? kcalTarget - avgKcal : null
  const onTrack = deficit !== null ? deficit >= -200 : null

  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">This Week</p>
          <p className="text-sm font-bold text-foreground mt-0.5">{daysLogged} of 7 days logged</p>
        </div>
        {onTrack !== null && (
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            onTrack
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-600'
          }`}>
            {onTrack ? '✓ On track' : '↑ Over target'}
          </span>
        )}
      </div>

      {/* Day mini-bars */}
      <div className="flex gap-1.5 mb-4">
        {days.map((day) => {
          const pct = kcalTarget && day.kcal > 0 ? Math.min((day.kcal / kcalTarget) * 100, 100) : 0
          const barColor = !day.logged
            ? 'bg-gray-200'
            : day.kcal > (kcalTarget ?? Infinity) * 1.1
            ? 'bg-rose-400'
            : day.kcal >= (kcalTarget ?? 0) * 0.8
            ? 'bg-emerald-500'
            : 'bg-indigo-400'

          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-muted">{day.label}</span>
              <div
                className={`relative w-full rounded-lg overflow-hidden bg-gray-100 ${
                  day.isToday ? 'ring-2 ring-indigo-400 ring-offset-1' : ''
                }`}
                style={{ height: 36 }}
              >
                <div
                  className={`absolute bottom-0 left-0 right-0 rounded-lg transition-all duration-500 ${barColor}`}
                  style={{ height: `${pct}%` }}
                />
                {day.logged && (
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white drop-shadow">
                    {day.kcal >= 1000 ? `${(day.kcal / 1000).toFixed(1)}k` : Math.round(day.kcal)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 divide-x divide-border text-center">
        <div className="pr-2">
          <p className="text-lg font-black text-foreground leading-tight">
            {daysLogged}<span className="text-sm font-normal text-muted">/7</span>
          </p>
          <p className="text-[10px] text-muted mt-0.5">Days</p>
        </div>
        <div className="px-2">
          <p className="text-lg font-black text-foreground leading-tight">
            {avgKcal > 0 ? avgKcal.toLocaleString() : '—'}
          </p>
          <p className="text-[10px] text-muted mt-0.5">Avg/day</p>
        </div>
        <div className="pl-2">
          {deficit !== null ? (
            <>
              <p className={`text-lg font-black leading-tight ${deficit >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {deficit >= 0 ? '−' : '+'}{Math.abs(deficit).toLocaleString()}
              </p>
              <p className="text-[10px] text-muted mt-0.5">Deficit</p>
            </>
          ) : (
            <>
              <p className="text-lg font-black text-foreground leading-tight">
                {totalKcal > 0 ? `${(totalKcal / 1000).toFixed(1)}k` : '—'}
              </p>
              <p className="text-[10px] text-muted mt-0.5">Total</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
