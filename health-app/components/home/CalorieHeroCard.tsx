'use client'

import { useEffect, useRef, useState } from 'react'

// Ember Air hero: a 132px calorie ring (ember, always — no red over-goal
// state) with the eaten total centred, two stacked stats beside it, and the
// three macro rings folded in below a hairline (the 2c variant, ink progress).

const RING = 132
const RING_R = 58
const RING_C = RING / 2
const RING_CIRC = 2 * Math.PI * RING_R

const MACRO = 38
const MACRO_R = 15
const MACRO_C = MACRO / 2
const MACRO_CIRC = 2 * Math.PI * MACRO_R

interface Props {
  eaten: number
  target: number
  proteinEaten: number
  carbsEaten: number
  fatEaten: number
  proteinTarget: number
  carbsTarget: number
  fatTarget: number
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

function MacroRing({ label, eaten, target, color }: { label: string; eaten: number; target: number; color: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const pct = target > 0 ? Math.min(eaten / target, 1) : 0
  const offset = MACRO_CIRC * (1 - (mounted ? pct : 0))
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative shrink-0" style={{ width: MACRO, height: MACRO }}>
        <svg width={MACRO} height={MACRO} viewBox={`0 0 ${MACRO} ${MACRO}`}>
          <circle cx={MACRO_C} cy={MACRO_C} r={MACRO_R} fill="none" stroke="var(--surface-2)" strokeWidth={5} />
          <circle
            cx={MACRO_C} cy={MACRO_C} r={MACRO_R} fill="none" stroke={color} strokeWidth={5}
            strokeLinecap="round" strokeDasharray={MACRO_CIRC} strokeDashoffset={offset}
            transform={`rotate(-90 ${MACRO_C} ${MACRO_C})`}
            style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.22,1,.36,1)' }}
          />
        </svg>
      </div>
      <div>
        <p className="text-[13px] font-bold tabular-nums text-ink leading-none">{Math.round(eaten)}g</p>
        <p className="mt-[1px] text-[10px] text-ink-3">{label}</p>
      </div>
    </div>
  )
}

export function CalorieHeroCard({
  eaten, target, proteinEaten, carbsEaten, fatEaten, proteinTarget, carbsTarget, fatTarget,
}: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const pct = target > 0 ? Math.min(eaten / target, 1) : 0
  const offset = RING_CIRC * (1 - (mounted ? pct : 0))
  const shown = useCountUp(eaten)
  const over = eaten - target

  return (
    <div className="rounded-[24px] bg-surface px-6 py-[26px]" style={{ boxShadow: 'var(--shadow-air)' }}>
      <div className="flex items-center gap-6">
        {/* Ring */}
        <div className="relative shrink-0" style={{ width: RING, height: RING }}>
          <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
            <circle cx={RING_C} cy={RING_C} r={RING_R} fill="none" stroke="var(--surface-2)" strokeWidth={10} />
            <circle
              cx={RING_C} cy={RING_C} r={RING_R} fill="none" stroke="var(--brand)" strokeWidth={10}
              strokeLinecap="round" strokeDasharray={RING_CIRC} strokeDashoffset={offset}
              transform={`rotate(-90 ${RING_C} ${RING_C})`}
              style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.22,1,.36,1)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-[32px] font-bold tabular-nums leading-none text-ink" style={{ letterSpacing: '-0.03em' }}>
              {shown.toLocaleString('en-IN')}
            </span>
            <span className="mt-1 text-[11.5px] text-ink-3">kcal eaten</span>
          </div>
        </div>

        {/* Stacked stats */}
        <div className="flex flex-1 flex-col gap-4">
          <div>
            <p className="font-display text-[22px] font-bold tabular-nums leading-none text-ink" style={{ letterSpacing: '-0.02em' }}>
              {Math.abs(Math.round(over)).toLocaleString('en-IN')}
            </p>
            <p className="mt-1 text-[12px] text-ink-3">{over >= 0 ? 'over goal' : 'kcal left'}</p>
          </div>
          <div>
            <p className="font-display text-[22px] font-bold tabular-nums leading-none text-ink" style={{ letterSpacing: '-0.02em' }}>
              {target.toLocaleString('en-IN')}
            </p>
            <p className="mt-1 text-[12px] text-ink-3">daily goal</p>
          </div>
        </div>
      </div>

      {/* Macro rings, folded in below a hairline (2c) */}
      <div className="mt-5 flex justify-between border-t border-hairline px-1.5 pt-4">
        <MacroRing label="Protein" eaten={proteinEaten} target={proteinTarget} color="var(--protein)" />
        <MacroRing label="Carbs" eaten={carbsEaten} target={carbsTarget} color="var(--carbs)" />
        <MacroRing label="Fat" eaten={fatEaten} target={fatTarget} color="var(--fat)" />
      </div>
    </div>
  )
}
