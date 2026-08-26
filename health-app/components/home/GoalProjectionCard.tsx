'use client'

import Link from 'next/link'
import type { GoalProjection } from '../../lib/goalProjection'
import { goalProjectionCopy } from '../../lib/goalProjection'
import { useHomeSlot } from '../dashboard/HomeSlot'

/**
 * The projected-goal-date moment on Home.
 *
 * A calorie number tells someone what they did today. A date tells them what it
 * is FOR — and the audit's answer to "why no day 2?" was that nothing on day 1
 * was worth coming back to. This is that thing, and the data already existed;
 * it was surfaced on onboarding, the plan card, /weight and /upgrade, but not on
 * the one screen people actually open every day.
 *
 * All the judgement lives in lib/goalProjection: which projection applies,
 * whether to show one at all, and the exact wording (measured states a fact,
 * planned states a condition). This component renders it and nothing more —
 * which is what keeps the honesty rules under test rather than under review.
 *
 * Ember Air surface rules: 20px radius, --shadow-air, ember reserved for data.
 * The date is the datum, so it is the only ember thing here.
 */
export function GoalProjectionCard({
  projection,
  targetKg,
}: {
  projection: GoalProjection
  targetKg: number | null
}) {
  // Computed before the slot claim rather than short-circuiting above it: a
  // hook cannot sit behind an early return, and `goalProjectionCopy` is pure so
  // running it every render costs nothing. It returns null for `kind: 'none'`,
  // which is the real suppression — the prop itself is never null.
  const copy = targetKg == null ? null : goalProjectionCopy(projection, targetKg)

  // See components/dashboard/HomeSlot.tsx — one attention card on Home.
  const wins = useHomeSlot('goal-projection', copy !== null)
  if (!copy || !wins) return null

  const isMeasured = projection.kind === 'measured'

  return (
    <Link
      href="/weight"
      // mt-4 lives here rather than on a wrapper in DashboardClient: the card
      // can decline to render, and a wrapper would have left its margin behind.
      className="mt-4 flex w-full items-center gap-3.5 rounded-card bg-surface p-3.5 text-left tap-scale"
      style={{ boxShadow: 'var(--shadow-air)' }}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-brand-soft"
        aria-hidden="true"
      >
        <span className="text-title-sm leading-none">{isMeasured ? '🎯' : '🌱'}</span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-body font-semibold leading-snug text-ink">{copy.headline}</p>
        <p className="mt-[3px] text-caption leading-snug text-ink-3">{copy.detail}</p>
      </div>
    </Link>
  )
}
