'use client'

import { useWater } from '../../hooks/useWater'

const QUICK_AMOUNTS = [
  { label: 'Glass', ml: 250, emoji: '🥛' },
  { label: 'Bottle', ml: 500, emoji: '🍶' },
  { label: 'Large', ml: 750, emoji: '🫗' },
]

export function WaterTracker({ targetMl = 2500 }: { targetMl?: number }) {
  const { ml, cups, targetCups, pct, add, mounted } = useWater(targetMl)

  if (!mounted) {
    return (
      <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50 p-4 shadow-sm animate-pulse h-36" />
    )
  }

  const isComplete = ml >= targetMl
  const remaining = Math.max(targetMl - ml, 0)

  return (
    <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-cyan-50 to-sky-50 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">💧</span>
          <div>
            <p className="text-sm font-bold text-blue-800">Water</p>
            <p className="text-xs text-blue-500">
              {isComplete ? '🎉 Goal reached!' : `${remaining} ml to go`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-blue-700 leading-none">{cups}</p>
          <p className="text-xs text-blue-400">of {targetCups} cups</p>
        </div>
      </div>

      {/* Wave progress bar */}
      <div className="relative h-3 rounded-full bg-blue-100 overflow-hidden mb-3">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* ml text */}
      <p className="text-xs text-blue-500 mb-3">
        {ml} / {targetMl} ml
      </p>

      {/* Quick add buttons */}
      <div className="flex gap-2">
        {QUICK_AMOUNTS.map(({ label, ml: amount, emoji }) => (
          <button
            key={label}
            type="button"
            onClick={() => add(amount)}
            className="flex-1 flex flex-col items-center gap-0.5 rounded-2xl bg-white/70 border border-blue-100 py-2 text-xs font-semibold text-blue-700 hover:bg-white hover:border-blue-300 active:scale-95 transition-all"
          >
            <span className="text-base">{emoji}</span>
            <span>+{amount}ml</span>
          </button>
        ))}
        {ml > 0 && (
          <button
            type="button"
            onClick={() => add(-250)}
            className="flex-1 flex flex-col items-center gap-0.5 rounded-2xl bg-white/50 border border-blue-100 py-2 text-xs font-semibold text-blue-400 hover:bg-white hover:text-rose-500 hover:border-rose-200 active:scale-95 transition-all"
          >
            <span className="text-base">↩️</span>
            <span>Undo</span>
          </button>
        )}
      </div>
    </div>
  )
}
