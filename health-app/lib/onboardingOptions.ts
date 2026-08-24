/**
 * The two personalising questions onboarding asks, and the copy they drive.
 *
 * Onboarding used to collect only the body: height, weight, age, activity. All
 * of that answers "what should your number be" and none of it answers "why did
 * you go over yesterday" — so every user got identical coaching regardless of
 * whether their problem was late-night snacking or restaurant portions.
 *
 * These questions exist under one rule: **an answer that never changes what the
 * user sees is not worth a screen.** Onboarding was deliberately cut from six
 * screens to four (hooks/useOnboardingDraft.ts) because each screen is a place
 * to drop out, and at current scale the binding constraint is activation, not
 * conversion. Adding two back is only defensible because both are single-tap
 * and both surface immediately in the plan reveal. If a future question cannot
 * point at the pixel it changes, it does not belong here.
 *
 * Pure and shared, so the form and the plan reveal cannot drift into offering
 * one set of options and reading another.
 */

export const OBSTACLES = [
  {
    id: 'late_night',
    label: 'Late-night snacking',
    emoji: '🌙',
    /** One sentence. The plan reveal renders this verbatim. */
    plan: 'Log dinner before you sit down, not after — seeing what is left is what stops the second helping.',
  },
  {
    id: 'eating_out',
    label: 'Eating out & ordering in',
    emoji: '🛵',
    plan: 'Restaurant portions are the easiest thing in the world to underestimate, so search the dish before you order rather than after.',
  },
  {
    id: 'portions',
    label: 'Portion sizes',
    emoji: '🥣',
    plan: 'One katori measured once settles a hundred guesses — this app already defaults to real Indian portions rather than American cups.',
  },
  {
    id: 'sweets',
    label: 'Sweet cravings',
    emoji: '🍬',
    plan: 'Sweets are not banned here, they are budgeted — log one and see what it actually costs you.',
  },
  {
    id: 'no_time',
    label: 'No time to cook',
    emoji: '⏱️',
    plan: 'Repeat meals are one tap here, so the dish you cook on Sunday costs you a second to log on Wednesday.',
  },
  {
    id: 'weekends',
    label: 'Weekends undo the week',
    emoji: '📅',
    plan: 'Five good days and two lost ones is a maintenance week, and the weekly view is where you will finally see that happen.',
  },
] as const

export type ObstacleId = (typeof OBSTACLES)[number]['id']

export const OBSTACLE_IDS = OBSTACLES.map((o) => o.id) as readonly ObstacleId[]

/** At most three. A "pick anything that applies" list picks everything, and a user who names six problems has named none. */
export const MAX_OBSTACLES = 3

export const TRACKING_EXPERIENCES = [
  {
    id: 'never',
    label: 'Never counted calories',
    emoji: '🌱',
    /** Shapes the plan reveal's opening line rather than earning its own card. */
    plan: 'First time counting anything — so log one meal a day this week and leave accuracy for later.',
  },
  {
    id: 'tried',
    label: 'Tried it, did not stick',
    emoji: '🔁',
    plan: 'You have done this before and stopped, so the only thing that matters here is that logging stays fast enough to keep doing.',
  },
  {
    id: 'current',
    label: 'I track already',
    emoji: '📊',
    plan: 'You already track, so the difference here is a catalogue that knows what a katori of dal actually is.',
  },
] as const

export type TrackingExperienceId = (typeof TRACKING_EXPERIENCES)[number]['id']

export const TRACKING_EXPERIENCE_IDS = TRACKING_EXPERIENCES.map((t) => t.id) as readonly TrackingExperienceId[]

/** The default opener, for every account that onboarded before these questions existed. */
export const DEFAULT_PLAN_INTRO = 'Built from your height, weight, age and how active you are.'

export function isObstacleId(value: unknown): value is ObstacleId {
  return typeof value === 'string' && (OBSTACLE_IDS as readonly string[]).includes(value)
}

export function isTrackingExperienceId(value: unknown): value is TrackingExperienceId {
  return typeof value === 'string' && (TRACKING_EXPERIENCE_IDS as readonly string[]).includes(value)
}

/**
 * The sentence the plan reveal opens with.
 *
 * Null and unrecognised both fall back to the generic line rather than
 * guessing: the column is nullable precisely because "never asked" is a real
 * state, and inventing an answer would have the plan tell the user something
 * about themselves they never said.
 */
export function planIntroFor(experience: string | null | undefined): string {
  const match = TRACKING_EXPERIENCES.find((t) => t.id === experience)
  return match ? match.plan : DEFAULT_PLAN_INTRO
}

/**
 * The obstacle sentence for the plan reveal, or null when there is nothing
 * honest to say.
 *
 * Only the FIRST valid obstacle is used, even when three were chosen. The card
 * has room for one sentence, and three stacked pieces of advice is the shape
 * of a page nobody reads — the rest are stored and available to coaching later.
 */
export function obstaclePlanLine(obstacles: readonly string[] | null | undefined): string | null {
  if (!obstacles?.length) return null
  const first = obstacles.find(isObstacleId)
  if (!first) return null
  return OBSTACLES.find((o) => o.id === first)!.plan
}

/** Label for a stored id, for any surface that needs to echo the choice back. */
export function obstacleLabel(id: string): string | null {
  return OBSTACLES.find((o) => o.id === id)?.label ?? null
}

/**
 * Normalise whatever arrives from the client: drop unknown ids, drop
 * duplicates, cap the length. The Zod schema rejects malformed input at the
 * boundary; this keeps the stored array sane even as the option list changes
 * (an id retired later would otherwise linger in old rows and re-render).
 */
export function normaliseObstacles(input: readonly string[] | null | undefined): ObstacleId[] {
  if (!input?.length) return []
  const seen = new Set<ObstacleId>()
  for (const value of input) {
    if (isObstacleId(value)) seen.add(value)
    if (seen.size >= MAX_OBSTACLES) break
  }
  return [...seen]
}
