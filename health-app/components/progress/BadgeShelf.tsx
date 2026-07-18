'use client'

import { computeBadges, earnedCount, type BadgeStats } from '../../lib/badges'

const AIR = { boxShadow: 'var(--shadow-air)' } as const

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
    <div className="mt-3 rounded-[24px] bg-surface p-5" style={AIR}>
      <div className="flex items-baseline justify-between">
        <p className="text-[14px] font-bold text-ink">Badges</p>
        <p className="text-[12px] font-semibold tabular-nums text-ink-3">{earned} of 10</p>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-x-2 gap-y-4">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className="flex flex-col items-center text-center"
            title={badge.earned ? badge.name : `${badge.name} — ${badge.description}`}
          >
            <div
              className={
                'flex h-11 w-11 items-center justify-center rounded-full text-[20px] ' +
                (badge.earned ? 'bg-brand-soft' : 'bg-surface-2')
              }
              style={badge.earned ? undefined : { opacity: 0.45 }}
            >
              <span aria-hidden="true">{badge.emoji}</span>
            </div>
            <p
              className={
                'mt-1.5 text-[10.5px] leading-tight ' +
                (badge.earned ? 'font-semibold text-ink' : 'text-ink-3')
              }
            >
              {badge.name}
            </p>
            <span className="sr-only">
              {badge.earned ? `${badge.name}, earned.` : `${badge.name}, locked. ${badge.description}.`}
            </span>
          </div>
        ))}
      </div>

      {earned < 10 && (
        <p className="mt-4 text-[11px] text-ink-3">
          Tap and hold a locked badge to see how to earn it.
        </p>
      )}
    </div>
  )
}
