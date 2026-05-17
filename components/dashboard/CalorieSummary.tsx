'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/utils'

// Ring geometry
const R  = 96
const SW = 14        // stroke-width
const CX = 120
const CY = 120
const C  = 2 * Math.PI * R   // ≈ 603

export function CalorieSummary({
  kcalEaten,
  kcalBurned,
  kcalTarget,
}: {
  kcalEaten:  number
  kcalBurned: number
  kcalTarget: number
}) {
  const [mounted,    setMounted]    = useState(false)
  const [confetti,   setConfetti]   = useState(false)
  const celebrated = useRef(false)

  const net       = Math.max(kcalEaten - kcalBurned, 0)
  const remaining = Math.max(kcalTarget - net, 0)
  const over      = net > kcalTarget ? net - kcalTarget : 0
  const ratio     = kcalTarget > 0 ? Math.min(net / kcalTarget, 1) : 0
  const offset    = mounted ? C * (1 - ratio) : C

  // spring-in on mount
  useEffect(() => { setMounted(true) }, [])

  // confetti when goal reached
  useEffect(() => {
    if (kcalTarget <= 0) return
    if (net >= kcalTarget && !celebrated.current) {
      celebrated.current = true
      setConfetti(true)
      const t = setTimeout(() => setConfetti(false), 2200)
      return () => clearTimeout(t)
    }
    if (net < kcalTarget) celebrated.current = false
  }, [net, kcalTarget])

  // ring shifts green → amber → red
  const ringColor =
    ratio < 0.8 ? 'var(--primary)' : ratio <= 1 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center pt-6 pb-2 relative select-none">
      {confetti && <ConfettiBurst />}

      {/* ── Ring ── */}
      <div className="relative" style={{ width: 240, height: 240 }}>
        <svg
          width={240}
          height={240}
          viewBox="0 0 240 240"
          aria-hidden="true"
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Track */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth={SW}
            className="text-slate-100 dark:text-slate-800"
          />
          {/* Progress arc */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={ringColor}
            strokeWidth={SW}
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
            style={{
              transition: mounted
                ? 'stroke-dashoffset 1.1s cubic-bezier(0.34,1.56,0.64,1), stroke 0.5s ease'
                : 'none',
            }}
          />
        </svg>

        {/* ── Center label ── */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {over > 0 ? (
            <>
              <span className="text-[11px] font-semibold text-red-500 uppercase tracking-widest mb-1">
                Over goal
              </span>
              <span className="text-5xl font-black tabular-nums leading-none text-red-500">
                +{over.toLocaleString()}
              </span>
              <span className="text-xs text-muted mt-1.5">kcal over</span>
            </>
          ) : (
            <>
              <span className="text-[11px] font-semibold text-muted uppercase tracking-widest mb-1">
                Remaining
              </span>
              <span className="text-5xl font-black tabular-nums leading-none text-foreground">
                {remaining.toLocaleString()}
              </span>
              <span className="text-xs text-muted mt-1.5">kcal left</span>
            </>
          )}
        </div>
      </div>

      {/* ── Stats row below ring ── */}
      <div className="flex items-center gap-4 mt-5">
        <StatCol label="Eaten"  value={kcalEaten}  />
        <div className="h-8 w-px bg-border" />
        <StatCol label="Goal"   value={kcalTarget} />
        {kcalBurned > 0 && (
          <>
            <div className="h-8 w-px bg-border" />
            <StatCol label="Burned" value={kcalBurned} green />
            <div className="h-8 w-px bg-border" />
            <StatCol label="Net" value={Math.max(0, net)} />
          </>
        )}
      </div>
    </div>
  )
}

function StatCol({ label, value, green }: { label: string; value: number; green?: boolean }) {
  return (
    <div className="text-center">
      <p className={cn('text-xl font-black tabular-nums leading-none', green && 'text-emerald-600 dark:text-emerald-400')}>
        {value.toLocaleString()}
      </p>
      <p className="text-[10px] font-medium text-muted mt-1 uppercase tracking-wide">{label}</p>
    </div>
  )
}

function ConfettiBurst() {
  const pieces = [
    { left: '10%', delay: '0ms',   color: 'bg-indigo-400',  rotate: 'rotate-12' },
    { left: '20%', delay: '80ms',  color: 'bg-rose-400',    rotate: '-rotate-12' },
    { left: '32%', delay: '160ms', color: 'bg-emerald-400', rotate: 'rotate-6' },
    { left: '44%', delay: '40ms',  color: 'bg-amber-400',   rotate: '-rotate-6' },
    { left: '56%', delay: '120ms', color: 'bg-indigo-300',  rotate: 'rotate-12' },
    { left: '68%', delay: '200ms', color: 'bg-rose-300',    rotate: '-rotate-12' },
    { left: '78%', delay: '60ms',  color: 'bg-emerald-300', rotate: 'rotate-6' },
    { left: '88%', delay: '140ms', color: 'bg-amber-300',   rotate: '-rotate-6' },
  ]
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
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
