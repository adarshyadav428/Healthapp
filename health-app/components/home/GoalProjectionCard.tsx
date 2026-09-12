import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { GoalProjection } from '../../lib/goalProjection'
import { goalProjectionCopy } from '../../lib/goalProjection'

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
 * On Home it is a row in the feedback list, not a card: one sentence with
 * somewhere to go (/weight). Ink throughout — it is a prompt, not a datum.
 */
export function GoalProjectionCard({
  projection,
  targetKg,
}: {
  projection: GoalProjection
  targetKg: number | null
}) {
  if (targetKg == null) return null
  const copy = goalProjectionCopy(projection, targetKg)
  if (!copy) return null

  return (
    <Link href="/weight" className="flex w-full items-center gap-3 px-1 py-3.5 text-left tap-scale">
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium leading-snug text-ink">{copy.headline}</p>
        <p className="mt-0.5 text-caption leading-snug text-ink-3">{copy.detail}</p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={1.75} aria-hidden="true" />
    </Link>
  )
}
