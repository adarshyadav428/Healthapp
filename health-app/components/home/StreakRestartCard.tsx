'use client'

import Link from 'next/link'
import { Flame } from 'lucide-react'
import { streakRestart } from '../../lib/streakRestart'

/**
 * The comeback card.
 *
 * When a streak ends, the flame pill in the header simply stops rendering —
 * a twelve-day run disappears without the app saying anything at all. This
 * fills that silence with the one thing worth saying, and a single tap to act
 * on it.
 *
 * All the judgement (whether to speak, and in what words) lives in
 * lib/streakRestart. There is deliberately no dismiss button: the card is not
 * a message to be acknowledged, it is a prompt that removes itself the moment
 * the user logs anything, because that is what takes the streak off zero.
 */
export function StreakRestartCard({
  streakDays,
  longestStreakDays,
}: {
  streakDays: number
  longestStreakDays: number
}) {
  const copy = streakRestart(streakDays, longestStreakDays)
  if (!copy) return null

  return (
    <Link
      href="/log?search=1"
      className="mt-4 flex items-center gap-3.5 rounded-card bg-surface p-4 tap-scale"
      style={{ boxShadow: 'var(--shadow-air)' }}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Flame className="h-5 w-5" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body font-semibold leading-snug text-ink">{copy.title}</span>
        <span className="mt-1 block text-caption leading-relaxed text-ink-2">{copy.body}</span>
      </span>
    </Link>
  )
}
