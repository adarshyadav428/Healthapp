'use client'

import { useEffect, useRef, useState } from 'react'
import { Drumstick, Wheat, Droplet } from 'lucide-react'

// Ember Air hero (v2): a 132px calorie ring (ember, always — no red over-goal
// state) with the eaten total centred, the three macros as icon-rings down the
// right, and a "kcal left / goal" strip below a hairline.

const RING = 132
const RING_R = 58
const RING_C = RING / 2
const RING_CIRC = 2 * Math.PI * RING_R

const M = 34
const M_R = 13
const M_C = M / 2
const M_CIRC = 2 * Math.PI * M_R

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
      else clearTimeout(safety)
    }

    // requestAnimationFrame does not always run. Battery saver, a backgrounded
    // tab, and some embedded webviews suppress it entirely — and because this
    // hook starts at 0, the hero then renders a permanent "0 kcal eaten" while
    // the line right below it says "50 kcal over". Observed exactly that during
    // the 2026-07-31 audit in a tab where rAF never fired. The animation is
    // decoration; the number is not, so guarantee the number.
    const safety = setTimeout(() => {
      if (raf.current) cancelAnimationFrame(raf.current)
      setVal(target)
    }, duration + 300)

    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
      clearTimeout(safety)
    }
  }, [target, duration])
  return val
}

function MacroRow({ icon: Icon, label, eaten, target, color }: {
  icon: typeof Drumstick
  label: string
  eaten: number
  target: number
  color: string
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const pct = target > 0 ? Math.min(eaten / target, 1) : 0
  const offset = M_CIRC * (1 - (mounted ? pct : 0))
  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0" style={{ width: M, height: M }}>
        <svg width={M} height={M} viewBox={`0 0 ${M} ${M}`}>
          <circle cx={M_C} cy={M_C} r={M_R} fill="none" stroke="var(--surface-2)" strokeWidth={4} />
          <circle
            cx={M_C} cy={M_C} r={M_R} fill="none" stroke={color} strokeWidth={4}
            strokeLinecap="round" strokeDasharray={M_CIRC} strokeDashoffset={offset}
            transform={`rotate(-90 ${M_C} ${M_C})`}
            style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.22,1,.36,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="h-[13px] w-[13px]" strokeWidth={2} style={{ color }} />
        </div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-body font-bold tabular-nums text-ink">{Math.round(eaten)}g</span>
        <span className="text-caption text-ink-3">{label}</span>
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
  const kcalLeft = target - eaten

  return (
    <div className="rounded-card-lg bg-surface px-6 py-[26px]" style={{ boxShadow: 'var(--shadow-air)' }}>
      <div className="flex items-center gap-5">
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
            <span className="font-display text-display font-bold tabular-nums leading-none text-ink">
              {shown.toLocaleString('en-IN')}
            </span>
            <span className="mt-1 text-caption text-ink-3">kcal eaten</span>
          </div>
        </div>

        {/* Macros down the right */}
        <div className="flex flex-1 flex-col gap-3.5">
          <MacroRow icon={Drumstick} label="Protein" eaten={proteinEaten} target={proteinTarget} color="var(--protein)" />
          <MacroRow icon={Wheat} label="Carbs" eaten={carbsEaten} target={carbsTarget} color="var(--carbs)" />
          <MacroRow icon={Droplet} label="Fat" eaten={fatEaten} target={fatTarget} color="var(--fat)" />
        </div>
      </div>

      {/* kcal left / goal strip */}
      <div className="mt-5 flex items-baseline justify-between border-t border-hairline pt-4">
        <span className="text-caption text-ink-3">
          <b className="font-bold tabular-nums text-ink">{Math.abs(kcalLeft).toLocaleString('en-IN')}</b> kcal {kcalLeft >= 0 ? 'left' : 'over'}
        </span>
        <span className="text-caption text-ink-3">
          Goal <b className="font-bold tabular-nums text-ink">{target.toLocaleString('en-IN')}</b> kcal
        </span>
      </div>
    </div>
  )
}
