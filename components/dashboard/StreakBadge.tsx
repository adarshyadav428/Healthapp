'use client'

export function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-orange-200 bg-white/90 px-4 py-3 flex items-center gap-3">
        <span className="text-2xl">🌱</span>
        <div>
          <p className="text-sm font-semibold text-gray-800">Start your streak today!</p>
          <p className="text-xs text-gray-500">Log your first meal to begin</p>
        </div>
      </div>
    )
  }

  const flameCount = Math.min(streak >= 30 ? 3 : streak >= 7 ? 2 : 1, 3)

  return (
    <div className="rounded-3xl bg-gradient-to-r from-orange-50 via-amber-50 to-rose-50 border border-orange-100 px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <span className="text-2xl animate-pulse">{'🔥'.repeat(flameCount)}</span>
        <div>
          <p className="text-sm font-bold text-orange-700">{streak}-day streak!</p>
          <p className="text-xs text-orange-600">
            {streak >= 30 ? 'Legendary! Keep it up 🏆' : streak >= 7 ? "You're on fire! 🚀" : 'Great start!'}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-2xl font-black text-orange-600 leading-none">{streak}</p>
        <p className="text-xs text-orange-500">days</p>
      </div>
    </div>
  )
}
