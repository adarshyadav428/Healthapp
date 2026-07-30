/**
 * The monthly Wrapped: scheduling rules and card building.
 *
 * The scheduling half exists because vercel.json declares two crons and the
 * Hobby plan caps there — so rather than buying a plan to run one job a month,
 * the monthly wrap rides along inside the Sunday recap cron and asks this
 * module whether today is its day.
 *
 * Pure throughout, so the date arithmetic (which is where this kind of feature
 * goes wrong) is pinned by tests rather than discovered in production on the
 * first of some month.
 */

import type { StoryCard } from '../components/story/types'
import type { WrappedStats } from './wrappedStats'

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/** The IST calendar date, as parts, for an instant. */
function istParts(date: Date): { year: number; month: number; day: number; weekday: number } {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
  }
}

/**
 * Is this the first Sunday of an IST month?
 *
 * The trigger has to be a *Sunday* because that's when the host cron runs; "the
 * 1st of the month" would fire on a day the cron isn't scheduled and the wrap
 * would simply never be written. The first Sunday is days 1–7 by definition.
 */
export function isFirstSundayOfMonth(date: Date): boolean {
  const { day, weekday } = istParts(date)
  return weekday === 0 && day <= 7
}

/**
 * The window in which the monthly wrap may be generated: any Sunday in the
 * first fortnight.
 *
 * Wider than `isFirstSundayOfMonth` on purpose. The host cron is deadline-bound
 * and stops partway when there are more users than fit in one invocation — with
 * a single-Sunday trigger, everyone it didn't reach would silently never get a
 * Wrapped, and the next chance would be a month later. The second Sunday mops
 * up; users already written are skipped by the unique (user_id, month_start)
 * row, so nobody is wrapped twice or pushed twice.
 */
export function isMonthlyWrapWindow(date: Date): boolean {
  const { day, weekday } = istParts(date)
  return weekday === 0 && day <= 14
}

/** First IST day (YYYY-MM-01) of the month BEFORE `date` — the one being wrapped. */
export function previousMonthStart(date: Date): string {
  const { year, month } = istParts(date)
  const y = month === 1 ? year - 1 : year
  const m = month === 1 ? 12 : month - 1
  return `${y}-${String(m).padStart(2, '0')}-01`
}

/** ISO instant for the start of the IST day `monthStart` (YYYY-MM-DD). */
export function istDayStartInstant(dayKey: string): string {
  return new Date(Date.parse(`${dayKey}T00:00:00Z`) - IST_OFFSET_MS).toISOString()
}

/** "July 2026", from a YYYY-MM-01 key. */
export function monthLabel(monthStart: string): string {
  const [y, m] = monthStart.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * A month with almost nothing in it isn't a story, it's a reminder that you
 * stopped using the app. Below this no wrap is written at all.
 */
export const MIN_DAYS_FOR_WRAP = 5

export type MonthlyWrappedArgs = {
  stats: WrappedStats
  monthStart: string
  message: string
  isPro: boolean
}

/**
 * The Wrapped sequence.
 *
 * Free users get the opening, one real stat, and an honest wall — not a
 * degraded story pretending to be complete. The wall works here in a way the
 * app's other paywalls don't: they block something the user wanted to do, while
 * this one withholds something about *them* that they can already see exists.
 */
export function buildMonthlyWrappedCards({ stats, monthStart, message, isPro }: MonthlyWrappedArgs): StoryCard[] {
  const label = monthLabel(monthStart)

  const opening: StoryCard = {
    id: 'wrap-hello',
    tone: 'ember',
    glyph: '📖',
    eyebrow: label,
    title: 'Your month.',
    body: message,
  }

  const days: StoryCard = {
    id: 'wrap-days',
    glyph: '📆',
    value: String(stats.daysLogged),
    label: stats.daysLogged === 1 ? 'day logged' : 'days logged',
  }

  if (!isPro) {
    return [
      opening,
      days,
      {
        id: 'wrap-locked',
        glyph: '🔒',
        title: 'The rest of your month',
        body: 'Your most-logged dish, your best day, your longest streak and your weight curve — all in your Wrapped with Pro.',
      },
    ]
  }

  const cards: StoryCard[] = [opening, days]

  if (stats.totalMeals >= 10) {
    cards.push({ id: 'wrap-meals', glyph: '🍛', value: String(stats.totalMeals), label: 'meals logged' })
  }

  if (stats.topFood && stats.topFood.count >= 3) {
    cards.push({
      id: 'wrap-top-food',
      glyph: '🥘',
      value: `${stats.topFood.count}×`,
      label: stats.topFood.name,
      body: `Your most-logged dish of ${label}.`,
    })
  }

  if (stats.longestStreakDays >= 3) {
    cards.push({
      id: 'wrap-streak',
      glyph: '🔥',
      value: String(stats.longestStreakDays),
      label: 'day best streak',
    })
  }

  if (stats.bestDay) {
    cards.push({
      id: 'wrap-best-day',
      glyph: '🏅',
      value: `${stats.bestDay.proteinG}g`,
      label: 'protein on your best day',
      body: 'The day you fed yourself properly.',
    })
  }

  // Unlike the welcome sequence, a gain IS shown here. A Wrapped is a record of
  // what happened, and a monthly review that only ever reports good news is one
  // nobody can trust the next time it reports good news.
  if (stats.weightDeltaKg != null && Math.abs(stats.weightDeltaKg) >= 0.1) {
    const down = stats.weightDeltaKg < 0
    cards.push({
      id: 'wrap-weight',
      glyph: '⚖️',
      value: `${Math.abs(stats.weightDeltaKg).toFixed(1)} kg`,
      label: down ? 'down this month' : 'up this month',
      body: down ? undefined : 'Months like this happen. The logging is what fixes them.',
    })
  }

  cards.push({
    id: 'wrap-go',
    tone: 'ember',
    glyph: '📣',
    title: 'Share your month.',
    body: 'Your plate, your numbers — one tap.',
  })

  return cards
}
