'use client'

import { useMemo } from 'react'
import { useUser } from '../../hooks/useUser'
import { useWaterLogs } from '../../hooks/useWaterLogs'

const QUICK = [
  { label: 'Glass',  ml: 250, emoji: '🥛' },
  { label: 'Bottle', ml: 500, emoji: '🍶' },
  { label: 'Large',  ml: 750, emoji: '🫗' },
]

export function WaterCard({ targetMl = 2500 }: { targetMl?: number }) {
  const { user } = useUser()
  const { totalMl, isLoading, add, undo } = useWaterLogs(user?.id ?? null)

  const cups = useMemo(() => Math.floor(totalMl / 250), [totalMl])
  const targetCups = useMemo(() => Math.floor(targetMl / 250), [targetMl])
  const pct = useMemo(() => (targetMl > 0 ? Math.min((totalMl / targetMl) * 100, 100) : 0), [totalMl, targetMl])

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-sky-100 dark:border-sky-900/30 bg-white/90 dark:bg-slate-900/80 p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">Water</p>
        <p className="mt-1 text-2xl font-black text-foreground">--</p>
        <div className="mt-4 h-2 rounded-full bg-sky-50 dark:bg-slate-700" />
      </div>
    )
  }

  const remaining = Math.max(targetMl - totalMl, 0)
  const isComplete = totalMl >= targetMl

  return (
    <div className="rounded-3xl border border-sky-100 dark:border-sky-900/30 bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-sky-950/30 dark:to-cyan-950/20 p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">Water</p>
          <p className="mt-0.5 text-2xl font-black text-foreground leading-none">{cups}</p>
          <p className="text-xs text-sky-500 dark:text-sky-400 mt-0.5">
            {isComplete ? '🎉 Goal reached!' : `${remaining}ml left · ${targetCups} cup goal`}
          </p>
        </div>
        <span className="text-xl">💧</span>
      </div>

      <div className="h-2 rounded-full bg-sky-100 dark:bg-sky-900/40 overflow-hidden mb-3">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-400 to-cyan-400 transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex gap-1.5">
        {QUICK.map(({ label, ml: amount, emoji }) => (
          <button
            key={label}
            type="button"
            onClick={() => add(amount)}
            disabled={!user}
            className="flex-1 flex flex-col items-center gap-0.5 rounded-xl bg-white/70 dark:bg-slate-800/60 border border-sky-100 dark:border-sky-900/30 py-1.5 text-[11px] font-semibold text-sky-700 dark:text-sky-400 hover:bg-white dark:hover:bg-slate-700 active:scale-95 transition-all disabled:opacity-50"
          >
            <span>{emoji}</span>
            <span>+{amount}</span>
          </button>
        ))}
        {totalMl > 0 && (
          <button
            type="button"
            onClick={undo}
            disabled={!user}
            className="flex-1 flex flex-col items-center gap-0.5 rounded-xl bg-white/50 dark:bg-slate-800/40 border border-sky-100 dark:border-sky-900/30 py-1.5 text-[11px] font-semibold text-sky-400 hover:text-rose-500 hover:border-rose-200 dark:hover:border-rose-800 active:scale-95 transition-all disabled:opacity-50"
          >
            <span>↩️</span>
            <span>Undo</span>
          </button>
        )}
      </div>
    </div>
  )
}
