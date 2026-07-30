/**
 * The badge set — exactly ten, permanently.
 *
 * Ten is a deliberate cap, not a starting point. A badge shelf that keeps
 * growing turns into a chore list, and the moment there are forty of them each
 * one stops meaning anything. Ten fits on one screen with no scrolling and can
 * be read at a glance, which is the only thing a badge shelf is actually for.
 *
 * The ladder mixes four kinds of progress on purpose — streak, volume, body
 * change, and feature depth — so nobody is locked out of the whole set by one
 * weakness. Someone who logs faithfully but hasn't lost weight yet still has
 * things to earn.
 *
 * Pure so it's unit-testable (tests/badges.test.ts).
 */

export type BadgeId =
  | 'first_log' | 'week_one' | 'fortnight' | 'consistent' | 'centurion'
  | 'protein_pro' | 'scale_keeper' | 'meal_planner' | 'first_kilo' | 'five_down'

export type Badge = {
  id: BadgeId
  name: string
  /** What earns it — shown whether or not it's earned. */
  description: string
  emoji: string
  earned: boolean
  /** 0–1 progress toward earning. 1 when earned. */
  progress: number
}

export type BadgeStats = {
  totalLogs: number
  currentStreak: number
  /** Best streak ever reached — a badge earned should never be un-earned. */
  longestStreak: number
  proteinTargetDaysHit: number
  weighIns: number
  savedMealTemplates: number
  /** Kilos below the start weight; negative or null when not down. */
  kgLost: number | null
}

/** Fraction of the way to `goal`, clamped to 0–1. */
function ratio(value: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.min(1, Math.max(0, value / goal))
}

/**
 * The four streak rungs, in ascending order — the single source of truth for
 * both the shelf below and the Home "next milestone" nudge. Kept out of
 * `computeBadges` so the two can never drift apart: a nudge promising a badge
 * at a threshold the shelf doesn't award would be a small, corrosive lie.
 */
export const STREAK_BADGE_LADDER: readonly { id: BadgeId; name: string; emoji: string; days: number }[] = [
  { id: 'week_one',   name: 'Week One',   emoji: '🔥', days: 7 },
  { id: 'fortnight',  name: 'Fortnight',  emoji: '⚡', days: 14 },
  { id: 'consistent', name: 'Consistent', emoji: '💎', days: 30 },
  { id: 'centurion',  name: 'Centurion',  emoji: '👑', days: 100 },
] as const

export function computeBadges(stats: BadgeStats): Badge[] {
  const lost = stats.kgLost ?? 0
  // Streak badges read from the LONGEST streak, never the current one. Losing a
  // badge because you missed a Tuesday would make the shelf a source of dread
  // instead of a record of what you've done.
  const best = Math.max(stats.longestStreak, stats.currentStreak)
  const rung = (id: BadgeId) => STREAK_BADGE_LADDER.find((r) => r.id === id)!

  const defs: [BadgeId, string, string, string, number, number][] = [
    ['first_log',    'First Step',    'Log your first meal',                '🌱', stats.totalLogs, 1],
    ['week_one',     rung('week_one').name,   'Reach a 7-day streak',       rung('week_one').emoji,   best, rung('week_one').days],
    ['fortnight',    rung('fortnight').name,  'Reach a 14-day streak',      rung('fortnight').emoji,  best, rung('fortnight').days],
    ['consistent',   rung('consistent').name, 'Reach a 30-day streak',      rung('consistent').emoji, best, rung('consistent').days],
    ['centurion',    rung('centurion').name,  'Reach a 100-day streak',     rung('centurion').emoji,  best, rung('centurion').days],
    ['protein_pro',  'Protein Pro',   'Hit your protein target on 7 days',  '🥚', stats.proteinTargetDaysHit, 7],
    ['scale_keeper', 'Scale Keeper',  'Record 10 weigh-ins',                '⚖️', stats.weighIns, 10],
    ['meal_planner', 'Meal Planner',  'Save 3 meal combos',                 '📋', stats.savedMealTemplates, 3],
    ['first_kilo',   'First Kilo',    'Lose your first kilo',               '🎯', lost, 1],
    ['five_down',    'Five Down',     'Lose 5 kg from your start weight',   '🏆', lost, 5],
  ]

  return defs.map(([id, name, description, emoji, value, goal]) => ({
    id,
    name,
    description,
    emoji,
    earned: value >= goal,
    progress: ratio(value, goal),
  }))
}

/** How many of the ten are earned — the number worth showing as a header. */
export function earnedCount(badges: Badge[]): number {
  return badges.filter((b) => b.earned).length
}

/**
 * Only nudge when the next rung is genuinely within reach. Duolingo's
 * proximity-to-reward pull works at "two more days"; at "94 more days" the same
 * line reads as a reminder of how far away it is, which is the opposite effect.
 */
export const NEXT_BADGE_MAX_DAYS_AWAY = 7

export type NextStreakBadge = { name: string; emoji: string; daysAway: number }

/**
 * The next streak badge worth mentioning on Home, or null when there isn't one.
 *
 * Deliberately narrow: the full shelf lives on Trends, and Home is a room you
 * live in rather than a moment (see the Ember Air doctrine) — so this surfaces
 * at most one line, and only when it's a nudge rather than a nag.
 *
 * `longest` matters because the shelf awards on the best streak ever reached, so
 * a rung already earned must never be offered again: someone whose best is 30
 * but whose current run is 5 has Week One and Fortnight already, and telling
 * them otherwise would contradict their own shelf.
 *
 * Pure, so tests/badges.test.ts can pin the boundaries.
 */
export function nextStreakBadge(current: number, longest = 0): NextStreakBadge | null {
  if (current <= 0) return null
  const best = Math.max(current, longest)

  const rung = STREAK_BADGE_LADDER.find((r) => r.days > best)
  if (!rung) return null // every rung earned — nothing left to chase

  const daysAway = rung.days - current
  if (daysAway < 1 || daysAway > NEXT_BADGE_MAX_DAYS_AWAY) return null

  return { name: rung.name, emoji: rung.emoji, daysAway }
}
