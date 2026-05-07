'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'

const R = 52
const STROKE = 11
const CX = 64
const CY = 64
const CIRCUMFERENCE = 2 * Math.PI * R  // ≈ 326.7

export function CalorieSummary({
  kcalEaten,
  kcalBurned,
  kcalTarget,
}: {
  kcalEaten: number
  kcalBurned: number
  kcalTarget: number
}) {
  const [mounted, setMounted] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const celebratedRef = useRef(false)

  const net       = Math.max(kcalEaten - kcalBurned, 0)
  const remaining = Math.max(kcalTarget - net, 0)
  const over      = net > kcalTarget ? net - kcalTarget : 0
  const ratio     = kcalTarget > 0 ? Math.min(net / kcalTarget, 1) : 0

  // Animate ring in on mount
  useEffect(() => { setMounted(true) }, [])

  // Confetti when goal hit
  useEffect(() => {
    if (kcalTarget <= 0) return
    if (net >= kcalTarget && !celebratedRef.current) {
      celebratedRef.current = true
      setShowConfetti(true)
      const t = setTimeout(() => setShowConfetti(false), 2200)
      return () => clearTimeout(t)
    }
    if (net < kcalTarget) celebratedRef.current = false
  }, [net, kcalTarget])

  const pct    = Math.round(ratio * 100)
  const offset = mounted ? CIRCUMFERENCE * (1 - ratio) : CIRCUMFERENCE

  // Ring changes colour: green → amber → red
  const ringColor =
    ratio < 0.8 ? '#22c55e' : ratio <= 1.0 ? '#f59e0b' : '#ef4444'
  const glowOpacity = Math.min(ratio, 1) * 0.35

  return (
    <div className="relative overflow-hidden rounded-[28px] bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-sm">
      {/* Colour blob behind the ring */}
      <div
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-44 w-44 rounded-full blur-3xl"
        style={{ backgroundColor: ringColor, opacity: glowOpacity }}
      />

      {showConfetti && <ConfettiBurst />}

      <div className="relative flex items-center gap-3 px-5 py-5">
        {/* ── Left column ── */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
            Net calories
          </p>

          <div>
            <p className="text-5xl font-black tabular-nums leading-none text-foreground">
              {net.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-muted">
              of {kcalTarget.toLocaleString()} goal
            </p>
          </div>

          {/* Remaining / Over pill */}
          <span
            className={cn(
              'inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-bold',
              over > 0
                ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
            )}
          >
            {over > 0
              ? `+${over.toLocaleString()} kcal over`
              : `${remaining.toLocaleString()} kcal left`}
          </span>

          {/* Eaten / Burned row */}
          <div className="flex gap-4 pt-1">
            <MiniStat label="Eaten"  value={kcalEaten}  />
            {kcalBurned > 0 && (
              <MiniStat label="Burned" value={kcalBurned} green />
            )}
          </div>
        </div>

        {/* ── Right: SVG ring ── */}
        <div className="relative flex-shrink-0" style={{ width: 128, height: 128 }}>
          <svg
            width={128}
            height={128}
            viewBox="0 0 128 128"
            style={{ transform: 'rotate(-90deg)' }}
          >
            {/* Track */}
            <circle
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE}
              className="text-gray-100 dark:text-slate-800"
            />
            {/* Progress */}
            <circle
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={ringColor}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              style={{
                transition: mounted
                  ? 'stroke-dashoffset 1s cubic-bezier(0.34,1.56,0.64,1), stroke 0.4s ease'
                  : 'none',
                filter: `drop-shadow(0 0 5px ${ringColor}55)`,
              }}
            />
          </svg>

          {/* Centre label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-black text-foreground tabular-nums leading-none">
              {pct}%
            </span>
            <span className="text-[9px] font-semibold text-muted mt-0.5">of goal</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function MiniStat({ label, value, green }: { label: string; value: number; green?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={cn('text-sm font-bold', green ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground')}>
        {value.toLocaleString()} kcal
      </p>
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
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.left}
          className={`confetti-piece ${p.color} ${p.rotate}`}
          style={{ left: p.left, animationDelay: p.delay }}
        />
      ))}
    </div>
  )
}
