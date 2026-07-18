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

export function computeBadges(stats: BadgeStats): Badge[] {
  const lost = stats.kgLost ?? 0
  // Streak badges read from the LONGEST streak, never the current one. Losing a
  // badge because you missed a Tuesday would make the shelf a source of dread
  // instead of a record of what you've done.
  const best = Math.max(stats.longestStreak, stats.currentStreak)

  const defs: [BadgeId, string, string, string, number, number][] = [
    ['first_log',    'First Step',    'Log your first meal',                '🌱', stats.totalLogs, 1],
    ['week_one',     'Week One',      'Reach a 7-day streak',               '🔥', best, 7],
    ['fortnight',    'Fortnight',     'Reach a 14-day streak',              '⚡', best, 14],
    ['consistent',   'Consistent',    'Reach a 30-day streak',              '💎', best, 30],
    ['centurion',    'Centurion',     'Reach a 100-day streak',             '👑', best, 100],
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
