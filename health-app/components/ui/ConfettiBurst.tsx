'use client'

import { useEffect, useState } from 'react'

// Brand + macro tokens only — reads as "ours" in both themes.
const COLORS = ['var(--brand)', 'var(--good)', 'var(--protein)', 'var(--carbs)', 'var(--fat)']
const PIECES = 14

/**
 * One-shot confetti burst using the .confetti-piece CSS in globals.css.
 * Absolutely positioned — parent must be `relative` (or the burst fills the
 * nearest positioned ancestor). Renders nothing under prefers-reduced-motion:
 * the CSS guard sets `animation: none`, which would otherwise leave static
 * opaque squares on screen.
 */
export function ConfettiBurst() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setEnabled(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  if (!enabled) return null

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: PIECES }, (_, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${((i * 37) % 92) + 4}%`,
            background: COLORS[i % COLORS.length],
            animationDelay: `${(i * 97) % 500}ms`,
          }}
        />
      ))}
    </div>
  )
}
