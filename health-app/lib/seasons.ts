/**
 * Seasons — a 30-day run with a focus, an end, and a badge.
 *
 * Everything else in the app is infinite. Streaks never conclude, badges sit
 * there, the goal weight is months out. Nothing ever *climaxes* — so there is
 * no narrative moment landing on the day a monthly subscriber decides whether
 * to keep paying. A season is the only mechanic here that creates an ending,
 * and it's deliberately timed to be one.
 *
 * Seasons are CODE, not rows. A `seasons` table would need an admin UI nobody
 * has time to build and would make the content treadmill someone's weekly job;
 * authored here they're versioned, reviewable, and testable. Only participation
 * is stored (migration 031).
 *
 * The calendar is the part competitors can't copy. Navratri, wedding season and
 * the pre-summer months are when Indian users actually care about this, and a
 * US app can only localise that badly.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/** What a season asks of you. */
export type SeasonFocus =
  /** Log food on N days of the run. */
  | 'consistency'
  /** Hit the protein target on N days of the run. */
  | 'protein'
  /** Record a weigh-in on N days of the run. */
  | 'weigh_in'

export type Season = {
  /** Stable id — stored on participation rows, so never renamed. */
  slug: string
  title: string
  /** One line on why this month, in this country. */
  blurb: string
  focus: SeasonFocus
  /** Days that must qualify, out of the run's length. */
  target: number
  /** Inclusive IST date keys. */
  startsOn: string
  endsOn: string
  /** Season badges are their own collection — see the note below. */
  badge: { name: string; emoji: string }
}

/**
 * ⚠️ Season badges are deliberately NOT part of the ten in lib/badges.ts.
 *
 * That set is capped at ten by written doctrine — "a deliberate cap, not a
 * starting point" — because a shelf that keeps growing becomes a chore list.
 * Season badges have a different contract: they're scarce by time (unavailable
 * once the season closes) and kept forever once earned. Mixing them into
 * `BadgeId` would quietly break the rule the badge shelf is built on.
 */
export const SEASONS: readonly Season[] = [
  {
    slug: '2026-08-monsoon-consistency',
    title: 'Monsoon Streak',
    blurb: 'Rain, no gym, no excuses — this one is about showing up.',
    focus: 'consistency',
    target: 25,
    startsOn: '2026-08-01',
    endsOn: '2026-08-30',
    badge: { name: 'Monsoon Streak', emoji: '🌧️' },
  },
  {
    slug: '2026-09-protein-month',
    title: 'Protein Month',
    blurb: 'The macro almost every Indian plate is short on. Thirty days to fix it.',
    focus: 'protein',
    target: 20,
    startsOn: '2026-09-01',
    endsOn: '2026-09-30',
    badge: { name: 'Protein Month', emoji: '🥚' },
  },
  {
    slug: '2026-10-navratri',
    title: 'Navratri Nine',
    blurb: 'Fasting, feasting, and everything in between — just keep logging it.',
    focus: 'consistency',
    target: 24,
    startsOn: '2026-10-01',
    endsOn: '2026-10-30',
    badge: { name: 'Navratri Nine', emoji: '🪔' },
  },
  {
    slug: '2026-11-wedding-season',
    title: 'Wedding Season',
    blurb: 'Six weddings, one you. Track through it instead of writing the month off.',
    focus: 'consistency',
    target: 22,
    startsOn: '2026-11-01',
    endsOn: '2026-11-30',
    badge: { name: 'Wedding Season', emoji: '💒' },
  },
  {
    slug: '2026-12-scale-honesty',
    title: 'Scale Honesty',
    blurb: 'The month everyone avoids the weighing scale. Step on it anyway.',
    focus: 'weigh_in',
    target: 15,
    startsOn: '2026-12-01',
    endsOn: '2026-12-30',
    badge: { name: 'Scale Honesty', emoji: '⚖️' },
  },
  {
    slug: '2027-01-new-year',
    title: 'January Actually',
    blurb: 'Everyone starts in January. This is about still being here on the 30th.',
    focus: 'consistency',
    target: 26,
    startsOn: '2027-01-01',
    endsOn: '2027-01-30',
    badge: { name: 'January Actually', emoji: '🎯' },
  },
] as const

/** IST date key (YYYY-MM-DD) for an instant. */
export function istDayKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** The season running on a given day, or null between seasons. */
export function currentSeason(now = new Date()): Season | null {
  const today = istDayKey(now)
  return SEASONS.find((s) => s.startsOn <= today && today <= s.endsOn) ?? null
}

/** Total days in a season's run, inclusive of both ends. */
export function seasonLength(season: Season): number {
  const start = Date.parse(`${season.startsOn}T00:00:00Z`)
  const end = Date.parse(`${season.endsOn}T00:00:00Z`)
  return Math.round((end - start) / 86_400_000) + 1
}

/** Days left including today; 0 once it has closed. */
export function daysRemaining(season: Season, now = new Date()): number {
  const today = Date.parse(`${istDayKey(now)}T00:00:00Z`)
  const end = Date.parse(`${season.endsOn}T00:00:00Z`)
  return Math.max(0, Math.round((end - today) / 86_400_000) + 1)
}

export type SeasonProgress = {
  season: Season
  /** Qualifying days so far. */
  done: number
  target: number
  /** 0–1. */
  fraction: number
  complete: boolean
  daysLeft: number
  /**
   * True when the target can no longer be reached even by qualifying every
   * remaining day. Surfaced so the UI can stop showing a progress bar that has
   * quietly become a countdown to failure.
   */
  outOfReach: boolean
}

/**
 * Progress from the set of IST days that qualified.
 *
 * The caller decides what "qualified" means per focus — food logs for
 * consistency, protein-target days for protein, weigh-ins for weigh_in — and
 * hands in the days. Keeping that out of here means this stays pure and the
 * qualification rules live next to the data that answers them.
 */
export function seasonProgress(
  season: Season,
  qualifyingDays: readonly string[],
  now = new Date()
): SeasonProgress {
  const inRange = new Set(
    qualifyingDays.filter((d) => d >= season.startsOn && d <= season.endsOn)
  )
  const done = inRange.size
  const daysLeft = daysRemaining(season, now)
  const complete = done >= season.target

  return {
    season,
    done,
    target: season.target,
    fraction: Math.min(1, done / season.target),
    complete,
    daysLeft,
    outOfReach: !complete && done + daysLeft < season.target,
  }
}

/**
 * The season wrap — shown once the run has closed.
 *
 * This is the ending the rest of the app never has, and it deliberately lands
 * around day 30, which is when a monthly subscriber decides whether to keep
 * paying. A win gets the badge; a near-miss gets counted honestly, because a
 * season that congratulates everyone is worth nothing to the people who won it.
 */
export function buildSeasonWrapCards(args: {
  season: Season
  done: number
  complete: boolean
  isPro: boolean
}): import('../components/story/types').StoryCard[] {
  const { season, done, complete, isPro } = args
  const cards: import('../components/story/types').StoryCard[] = [
    {
      id: 'season-hello',
      tone: 'ember',
      glyph: season.badge.emoji,
      eyebrow: 'Season over',
      title: season.title,
      body: season.blurb,
    },
    {
      id: 'season-days',
      glyph: '📆',
      value: `${done}/${season.target}`,
      label: season.focus === 'protein' ? 'protein days hit'
        : season.focus === 'weigh_in' ? 'days you weighed in'
        : 'days logged',
    },
  ]

  if (complete) {
    cards.push({
      id: 'season-badge',
      glyph: season.badge.emoji,
      title: `${season.badge.name} earned`,
      body: 'Yours permanently — this one can’t be won again.',
    })
  } else {
    // Named plainly. A near-miss dressed up as a win makes the next target
    // meaningless, and people can count.
    cards.push({
      id: 'season-near-miss',
      glyph: '🤏',
      value: String(Math.max(0, season.target - done)),
      label: 'days short',
      body: 'Not this one. The next season starts with a clean slate.',
    })
  }

  cards.push({
    id: 'season-go',
    tone: 'ember',
    glyph: '➡️',
    title: complete ? 'Next season awaits.' : 'Next season, then.',
    body: isPro
      ? 'Your wraps are kept — you can look back at every season you ran.'
      : 'Pro keeps every season wrap, so you can look back at the whole year.',
  })

  return cards
}
