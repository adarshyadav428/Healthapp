'use client'

export function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0) {
    return (
      <div className="rounded-card border border-dashed border-hairline bg-surface px-4 py-3.5 flex items-center gap-3">
        <span className="text-2xl">🌱</span>
        <div>
          <p className="text-sm font-bold text-ink">Start your streak</p>
          <p className="text-xs text-ink-2">Log food every day to build one</p>
        </div>
      </div>
    )
  }

  const flameCount = streak >= 30 ? 3 : streak >= 7 ? 2 : 1
  const label =
    streak >= 30 ? 'Legendary 🏆' : streak >= 7 ? 'On fire 🚀' : 'Great start!'

  return (
    <div className="rounded-card border border-hairline bg-energy-soft px-4 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-2xl leading-none">{'🔥'.repeat(flameCount)}</span>
        <div>
          <p className="text-sm font-bold text-energy-ink">
            {streak}-day streak
          </p>
          <p className="text-[11px] text-energy-ink opacity-80">{label}</p>
        </div>
      </div>
      <span className="font-display text-3xl font-bold tabular-nums text-energy-ink leading-none">
        {streak}
      </span>
    </div>
  )
}
