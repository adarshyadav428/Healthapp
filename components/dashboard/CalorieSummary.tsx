'use client'

import { useEffect, useRef, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { cn } from '../../lib/utils'

export function CalorieSummary({
  kcalEaten,
  kcalBurned,
  kcalTarget,
}: {
  kcalEaten: number
  kcalBurned: number
  kcalTarget: number
}) {
  const [showConfetti, setShowConfetti] = useState(false)
  const celebratedRef = useRef(false)
  const net = Math.max(kcalEaten - kcalBurned, 0)
  const remaining = Math.max(kcalTarget - net, 0)
  const over = net > kcalTarget ? net - kcalTarget : 0
  const ratio = kcalTarget > 0 ? Math.min(net / kcalTarget, 1) : 0

  useEffect(() => {
    if (kcalTarget <= 0) return
    if (net >= kcalTarget && !celebratedRef.current) {
      celebratedRef.current = true
      setShowConfetti(true)
      const timer = setTimeout(() => setShowConfetti(false), 2200)
      return () => clearTimeout(timer)
    }
    if (net < kcalTarget) celebratedRef.current = false
  }, [kcalEaten, kcalBurned, kcalTarget, net])

  const ringColor = ratio < 0.8 ? '#16a34a' : ratio <= 1 ? '#f59e0b' : '#ef4444'
  const ringBg = '#1e293b' // dark-safe neutral fill (invisible in light mode since opacity)

  const data = [
    { name: 'Net', value: net },
    { name: 'Remaining', value: Math.max(kcalTarget - net, 0) },
  ]

  return (
    <div className="relative overflow-hidden rounded-3xl border border-orange-100 dark:border-orange-900/30 bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 dark:from-orange-950/20 dark:via-amber-950/20 dark:to-rose-950/20 p-5 shadow-sm dark:bg-slate-900/80">
      <div className="pointer-events-none absolute -top-10 -right-8 h-28 w-28 rounded-full bg-amber-200/40 dark:bg-amber-800/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-10 h-32 w-32 rounded-full bg-rose-200/40 dark:bg-rose-800/20 blur-2xl" />
      {showConfetti ? <ConfettiBurst /> : null}

      <div className="relative flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-400">Net calories</p>
          <p className="text-4xl font-black text-foreground leading-none">
            {net.toLocaleString()}
          </p>
          <p className="text-sm text-muted">of {kcalTarget.toLocaleString()} goal</p>

          <div className="mt-3 flex gap-4">
            {over > 0 ? (
              <Stat label="Over goal" value={`+${over.toLocaleString()}`} color="text-rose-600 dark:text-rose-400" />
            ) : (
              <Stat label="Remaining" value={remaining.toLocaleString()} color="text-emerald-600 dark:text-emerald-400" />
            )}
          </div>

          <div className="mt-2 flex gap-4">
            <Stat label="Eaten"  value={kcalEaten.toLocaleString()}  color="text-muted" />
            <Stat label="Burned" value={kcalBurned.toLocaleString()} color="text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        {/* Donut ring */}
        <div className="relative h-32 w-32 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                innerRadius={42}
                outerRadius={58}
                startAngle={90}
                endAngle={-270}
                paddingAngle={ratio < 1 ? 3 : 0}
                strokeWidth={0}
              >
                <Cell fill={ringColor} />
                <Cell fill={ringBg} fillOpacity={0.08} />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className={cn('text-lg font-bold leading-none', over > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400')}>
              {over > 0 ? `+${over}` : remaining}
            </span>
            <span className="text-[10px] text-muted mt-0.5">{over > 0 ? 'over' : 'left'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConfettiBurst() {
  const pieces = [
    { left: '8%',  delay: '0ms',   color: 'bg-amber-400',   rotate: 'rotate-12' },
    { left: '18%', delay: '80ms',  color: 'bg-rose-400',    rotate: '-rotate-12' },
    { left: '28%', delay: '160ms', color: 'bg-emerald-400', rotate: 'rotate-6' },
    { left: '40%', delay: '40ms',  color: 'bg-orange-400',  rotate: '-rotate-6' },
    { left: '52%', delay: '120ms', color: 'bg-amber-300',   rotate: 'rotate-12' },
    { left: '62%', delay: '200ms', color: 'bg-rose-300',    rotate: '-rotate-12' },
    { left: '72%', delay: '60ms',  color: 'bg-emerald-300', rotate: 'rotate-6' },
    { left: '82%', delay: '140ms', color: 'bg-orange-300',  rotate: '-rotate-6' },
    { left: '92%', delay: '180ms', color: 'bg-amber-400',   rotate: 'rotate-12' },
  ]

  return (
    <div className="pointer-events-none absolute inset-0">
      {pieces.map((piece) => (
        <span
          key={`${piece.left}-${piece.delay}`}
          className={`confetti-piece ${piece.color} ${piece.rotate}`}
          style={{ left: piece.left, animationDelay: piece.delay }}
        />
      ))}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className={cn('text-base font-bold', color)}>{value} kcal</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  )
}
