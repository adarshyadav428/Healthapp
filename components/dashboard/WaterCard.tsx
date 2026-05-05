'use client'

import { useWater } from '../../hooks/useWater'

const QUICK = [
  { label: 'Glass', ml: 250, emoji: '🥛' },
  { label: 'Bottle', ml: 500, emoji: '🍶' },
  { label: 'Large', ml: 750, emoji: '🫗' },
]

export function WaterCard({ targetMl = 2500 }: { targetMl?: number }) {
  const { ml, cups, targetCups, pct, add, mounted } = useWater(targetMl)

  if (!mounted) {
    return (
      <div className="rounded-3xl border border-sky-100 bg-white/90 p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Water</p>
            <p className="mt-1 text-2xl font-black text-gray-900">--</p>
          </div>
          <div className="h-10 w-10 rounded-2xl bg-sky-100/80 flex items-center justify-center">💧</div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-sky-50" />
      </div>
    )
  }

  const remaining = Math.max(targetMl - ml, 0)
  const isComplete = ml >= targetMl

  return (
    <div className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 to-cyan-50 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Water</p>
          <p className="mt-0.5 text-2xl font-black text-gray-900 leading-none">{cups}</p>
          <p className="text-xs text-sky-500 mt-0.5">
            {isComplete ? '🎉 Goal reached!' : `${remaining}ml left · ${targetCups} cup goal`}
          </p>
        </div>
        <div className="h-10 w-10 rounded-2xl bg-sky-100/80 flex items-center justify-center text-sky-700 text-lg">
          💧
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-sky-100 overflow-hidden mb-3">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-400 transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Quick add */}
      <div className="flex gap-1.5">
        {QUICK.map(({ label, ml: amount, emoji }) => (
          <button
            key={label}
            type="button"
            onClick={() => add(amount)}
            className="flex-1 flex flex-col items-center gap-0.5 rounded-xl bg-white/70 border border-sky-100 py-1.5 text-[11px] font-semibold text-sky-700 hover:bg-white hover:border-sky-300 active:scale-95 transition-all"
          >
            <span>{emoji}</span>
            <span>+{amount}</span>
          </button>
        ))}
        {ml > 0 && (
          <button
            type="button"
            onClick={() => add(-250)}
            className="flex-1 flex flex-col items-center gap-0.5 rounded-xl bg-white/50 border border-sky-100 py-1.5 text-[11px] font-semibold text-sky-400 hover:text-rose-500 hover:border-rose-200 active:scale-95 transition-all"
          >
            <span>↩️</span>
            <span>Undo</span>
          </button>
        )}
      </div>
    </div>
  )
}
