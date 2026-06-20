'use client'

export function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card px-4 py-3.5 flex items-center gap-3">
        <span className="text-2xl">🌱</span>
        <div>
          <p className="text-sm font-bold text-foreground">Start your streak</p>
          <p className="text-xs text-muted">Log food every day to build one</p>
        </div>
      </div>
    )
  }

  const flameCount = streak >= 30 ? 3 : streak >= 7 ? 2 : 1
  const label =
    streak >= 30 ? 'Legendary 🏆' : streak >= 7 ? 'On fire 🚀' : 'Great start!'

  return (
    <div className="rounded-2xl border border-amber-100 dark:border-amber-900/30 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 px-4 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-2xl leading-none">{'🔥'.repeat(flameCount)}</span>
        <div>
          <p className="text-sm font-black text-amber-700 dark:text-amber-400">
            {streak}-day streak
          </p>
          <p className="text-[11px] text-amber-600/80 dark:text-amber-500">{label}</p>
        </div>
      </div>
      <span className="text-3xl font-black tabular-nums text-amber-600 dark:text-amber-400 leading-none">
        {streak}
      </span>
    </div>
  )
}
