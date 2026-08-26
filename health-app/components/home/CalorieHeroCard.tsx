'use client'

import { useEffect, useState } from 'react'
import { useCountUp } from '../../hooks/useCountUp'

/**
 * The calorie hero.
 *
 * Restructured against docs/design-teardown-2026-08-25.md. Two findings drove it:
 *
 * §8.2 — the number-to-label gap IS the hierarchy. Every reference app runs its
 * hero numeral at 44-56px against a 13px muted label, roughly 4:1. This card was
 * 36px against 13px (2.8:1), which is the ratio that reads as "competent" rather
 * than as "designed". The numeral is now 48px.
 *
 * §6 — macros are a three-column row of value/target pairs under the ring, not a
 * stack of icon-rings beside it. That is what freed the width: at 132px the ring
 * had to share the row, and a 48px numeral does not fit inside a 112px hole. Full
 * width, the ring goes to 160px and the numeral fits with room to spare.
 *
 * The pair itself (`37 / 95g`, eaten bold in ink, target muted) is the single
 * most repeated component across all five references, and it says something the
 * old bare "37g" could not: how far through the day this macro is.
 *
 * Accent rules unchanged: the arc is the only accented thing here. The macro
 * triad is deliberately NOT the accent, so "which macro" and "how am I doing"
 * never encode in the same colour.
 */

const RING = 160
const RING_STROKE = 12
const RING_R = (RING - RING_STROKE) / 2
const RING_C = RING / 2
const RING_CIRC = 2 * Math.PI * RING_R

const EASE = 'cubic-bezier(.22,1,.36,1)'

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

function MacroCell({ label, eaten, target, color, mounted }: {
  label: string
  eaten: number
  target: number
  color: string
  mounted: boolean
}) {
  const pct = target > 0 ? Math.min(eaten / target, 1) : 0
  // The bar already glides to its value. Without this the grams beside it
  // jumped, and a number snapping next to a bar that travels reads as a glitch
  // rather than as two things doing different jobs.
  const shownGrams = useCountUp(Math.round(eaten))

  return (
    <div className="min-w-0 flex-1">
      <p className="text-micro font-semibold uppercase tracking-caps text-ink-3">{label}</p>
      <p className="mt-1 truncate text-body font-bold tabular-nums text-ink">
        {shownGrams}
        <span className="font-medium text-ink-3">
          {' / '}
          {Math.round(target)}g
        </span>
      </p>
      <div className="mt-2 h-[5px] w-full overflow-hidden rounded-full bg-track">
        <div
          className="h-full rounded-full"
          style={{
            width: `${(mounted ? pct : 0) * 100}%`,
            backgroundColor: color,
            transition: `width 0.9s ${EASE}`,
          }}
        />
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
    <div className="rounded-card-lg bg-surface px-card py-7" style={{ boxShadow: 'var(--shadow-air)' }}>
      {/* ── Ring ── the only accented element on this card ── */}
      <div className="flex justify-center">
        <div className="relative" style={{ width: RING, height: RING }}>
          <div
            className="pointer-events-none absolute -inset-4"
            style={{ background: 'var(--ring-bloom)' }}
            aria-hidden="true"
          />
          <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} className="relative">
            <circle
              cx={RING_C} cy={RING_C} r={RING_R} fill="none"
              stroke="var(--track)" strokeWidth={RING_STROKE}
            />
            <circle
              cx={RING_C} cy={RING_C} r={RING_R} fill="none"
              stroke="var(--brand)" strokeWidth={RING_STROKE}
              strokeLinecap="round" strokeDasharray={RING_CIRC} strokeDashoffset={offset}
              transform={`rotate(-90 ${RING_C} ${RING_C})`}
              style={{ transition: `stroke-dashoffset 0.9s ${EASE}` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-hero font-bold tabular-nums leading-none text-ink">
              {shown.toLocaleString('en-IN')}
            </span>
            <span className="mt-1.5 text-caption text-ink-3">kcal eaten</span>
          </div>
        </div>
      </div>

      {/* ── Macros ── three value/target pairs, full width under the ring ── */}
      <div className="mt-7 flex gap-4">
        <MacroCell label="Protein" eaten={proteinEaten} target={proteinTarget} color="var(--protein)" mounted={mounted} />
        <MacroCell label="Carbs"   eaten={carbsEaten}   target={carbsTarget}   color="var(--carbs)"   mounted={mounted} />
        <MacroCell label="Fat"     eaten={fatEaten}     target={fatTarget}     color="var(--fat)"     mounted={mounted} />
      </div>

      {/* ── kcal left / goal strip ── */}
      <div className="mt-6 flex items-baseline justify-between border-t border-hairline pt-4">
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
