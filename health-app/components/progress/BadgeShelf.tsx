'use client'

import { computeBadges, earnedCount, type BadgeStats } from '../../lib/badges'
import { BRAND_TILE } from '../log/shortcuts'

/**
 * The ten-badge shelf.
 *
 * Unearned badges are shown, not hidden — a locked badge with its requirement
 * spelled out is the whole point ("save 3 meal combos" is a nudge; an empty
 * grid is not). They're dimmed rather than greyed to a different palette, so
 * the shelf stays one visual object.
 */
export function BadgeShelf({ stats }: { stats: BadgeStats }) {
  const badges = computeBadges(stats)
  const earned = earnedCount(badges)

  return (
    <section aria-label="Badges">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-title-sm font-semibold text-ink">Badges</h2>
        <p className="text-caption tabular-nums text-ink-3">{earned} of {badges.length}</p>
      </div>

      <ul className="mt-3 grid grid-cols-5 gap-x-2 gap-y-4">
        {badges.map((badge) => (
          <li
            key={badge.id}
            className="flex flex-col items-center text-center"
            title={badge.earned ? badge.name : `${badge.name} — ${badge.description}`}
          >
            <span
              className={
                'grid h-12 w-12 place-items-center rounded-control text-title-sm ' +
                (badge.earned ? '' : 'bg-surface-2 opacity-50 grayscale')
              }
              style={badge.earned ? BRAND_TILE : undefined}
            >
              <span aria-hidden="true">{badge.emoji}</span>
            </span>
            <p className={'mt-1.5 text-micro leading-tight ' + (badge.earned ? 'font-semibold text-ink' : 'text-ink-3')}>
              {badge.name}
            </p>
            <span className="sr-only">
              {badge.earned ? `${badge.name}, earned.` : `${badge.name}, locked. ${badge.description}.`}
            </span>
          </li>
        ))}
      </ul>

      {earned < badges.length && (
        <p className="mt-3 text-micro text-ink-3">Hold a locked badge to see how to earn it.</p>
      )}
    </section>
  )
}
