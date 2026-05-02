 'use client'

export function StreakBadge({ streak }: { streak: number }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">Streak</p>
      {streak > 0 ? (
        <p className="text-2xl font-semibold text-gray-900">🔥 {streak} day streak</p>
      ) : (
        <p className="text-base text-gray-700">Start your streak today!</p>
      )}
    </div>
  )
}
