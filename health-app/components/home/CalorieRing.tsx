'use client'

import { useEffect, useRef, useState } from 'react'

// Studio ring recipe: slim arc, gradient stroke, a blurred duplicate arc
// underneath for luminescence (strong on Onyx, whisper on Porcelain), a
// bloom field behind the ring on Porcelain only, and a count-up numeral.
const R = 86
const SIZE = 196
const C = SIZE / 2
const CIRCUMFERENCE = 2 * Math.PI * R

interface Props {
  eaten: number
  target: number
  kcalLeft: number
}

function useCountUp(target: number, duration = 800) {
  const [val, setVal] = useState(0)
  const raf = useRef<number>()
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVal(target)
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 4)
      setVal(Math.round(target * eased))
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [target, duration])
  return val
}

export function CalorieRing({ eaten, target, kcalLeft }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const pct = target > 0 ? Math.min(eaten / target, 1) : 0
  const offset = CIRCUMFERENCE * (1 - (mounted ? pct : 0))
  const isOver = eaten > target
  const shown = useCountUp(eaten)

  const arcProps = {
    cx: C, cy: C, r: R,
    fill: 'none',
    strokeWidth: 9,
    strokeLinecap: 'round' as const,
    strokeDasharray: CIRCUMFERENCE,
    strokeDashoffset: offset,
    transform: `rotate(-90, ${C}, ${C})`,
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        {/* Porcelain-only bloom field (transparent on Onyx) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{ inset: -26, background: 'var(--ring-bloom)' }}
        />

        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="relative"
          style={{ filter: 'var(--ring-drop)' }}
        >
          <defs>
            <linearGradient id="emberArc" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-hi)" />
              <stop offset="100%" stopColor="var(--accent-lo)" />
            </linearGradient>
          </defs>

          {/* Track */}
          <circle cx={C} cy={C} r={R} fill="none" stroke="var(--track)" strokeWidth={9} />

          {/* Luminescence: blurred duplicate under the real arc */}
          <circle
            {...arcProps}
            stroke={isOver ? 'var(--bad)' : 'url(#emberArc)'}
            style={{
              transition: 'stroke-dashoffset 0.9s cubic-bezier(.22,1,.36,1)',
              filter: 'blur(10px)',
              opacity: 'var(--arc-glow)' as unknown as number,
            }}
          />

          {/* Progress arc */}
          <circle
            {...arcProps}
            stroke={isOver ? 'var(--bad)' : 'url(#emberArc)'}
            style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.22,1,.36,1)' }}
          />
        </svg>

        {/* Center labels */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="text-[10px] font-medium uppercase tracking-[.14em] text-ink-3">Eaten</span>
          <span
            className="font-display tabular-nums font-bold text-ink leading-none"
            style={{ fontSize: 46, letterSpacing: '-0.03em' }}
          >
            {shown.toLocaleString('en-IN')}
          </span>
          <span className="text-[12px] text-ink-2">
            of <b className="font-semibold text-ink tabular-nums">{target.toLocaleString('en-IN')}</b> kcal
          </span>
        </div>
      </div>

      {/* Remaining pill */}
      <div className="mt-3.5 flex justify-center">
        <span className="rounded-full bg-surface-2 px-3.5 py-1.5 text-[12.5px] text-ink-2">
          <b className="font-semibold tabular-nums text-brand-ink">
            {Math.abs(kcalLeft).toLocaleString('en-IN')} kcal
          </b>{' '}
          {kcalLeft >= 0 ? 'remaining' : 'over goal'}
        </span>
      </div>
    </div>
  )
}
