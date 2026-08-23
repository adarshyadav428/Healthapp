/**
 * The comeback moment: what to say to someone whose streak has gone.
 *
 * Freezes prevent a break and the Pro rescue repairs one, but nothing in the
 * app spoke to a free user whose run had actually ended — the flame pill simply
 * stops rendering at zero, so a twelve-day streak vanishes without comment.
 * That silence is the single largest retention leak in the product: across
 * habit apps, well under 1% of people who lose a multi-day streak ever start
 * another one on their own.
 *
 * The tone is deliberately not congratulatory and not scolding. It names what
 * they did before as real, and makes the next step small enough to be obvious.
 * Nothing here nags: the card stops rendering the moment they log, because
 * logging is what takes the streak off zero.
 */

/** Below this, a previous run isn't a habit worth invoking. */
export const MIN_PREVIOUS_BEST = 3

export type StreakRestart = {
  /** The run they're being reminded of. */
  previousBest: number
  title: string
  body: string
}

/**
 * @param currentStreak     Today's streak — anything above zero means there is
 *                          nothing to restart.
 * @param longestStreakDays Their best run ever. `longestStreak` in lib/streak
 *                          ignores freezes, so this is a real run.
 */
export function streakRestart(
  currentStreak: number,
  longestStreakDays: number
): StreakRestart | null {
  if (currentStreak > 0) return null
  if (longestStreakDays < MIN_PREVIOUS_BEST) return null

  // Someone who once held a month is being reminded of something they proved
  // they can do; someone who held four days needs a smaller, truer claim.
  const body =
    longestStreakDays >= 21
      ? 'You have done this for weeks before. One meal today starts it again.'
      : longestStreakDays >= 7
        ? 'You had a real run going. One meal today starts the next one.'
        : 'One meal today and you are back on day one.'

  return {
    previousBest: longestStreakDays,
    title: `Your best run was ${longestStreakDays} days`,
    body,
  }
}
