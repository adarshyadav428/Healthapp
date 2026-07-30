/**
 * Meal context — where a meal was eaten.
 *
 * The narrow, defensible version of "track behaviours, not just food". It is
 * one optional field on a log, not a new tracker: migration 019 removed the
 * water/sleep/fasting/measurement trackers on purpose and this doesn't reopen
 * that. It exists to answer the one question the app couldn't — why some weeks
 * are quietly heavier than others.
 *
 * Pure, so the insight's honesty rules (how much evidence before it speaks) are
 * testable.
 */

export const MEAL_CONTEXTS = ['home', 'restaurant', 'travel', 'office'] as const
export type MealContext = (typeof MEAL_CONTEXTS)[number]

export const MEAL_CONTEXT_LABELS: Record<MealContext, { label: string; emoji: string }> = {
  home: { label: 'Home', emoji: '🏠' },
  restaurant: { label: 'Eating out', emoji: '🍽️' },
  travel: { label: 'Travelling', emoji: '✈️' },
  office: { label: 'Office', emoji: '💼' },
}

export function isMealContext(value: unknown): value is MealContext {
  return typeof value === 'string' && (MEAL_CONTEXTS as readonly string[]).includes(value)
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000
const istKey = (iso: string) => new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)

export type ContextLog = { logged_at: string; kcal: number; context?: string | null }

/**
 * Days need this many on each side before a comparison means anything. Below
 * it the "insight" is one bad Saturday, and an app that announces a pattern
 * from two data points teaches people to ignore its patterns.
 */
export const MIN_DAYS_PER_SIDE = 4

/** A gap this small isn't worth a sentence — it's noise dressed as a finding. */
export const MIN_KCAL_DIFFERENCE = 150

export type ContextInsight = {
  context: MealContext
  /** Mean kcal on days containing at least one meal with this context. */
  withAvgKcal: number
  /** Mean kcal on days containing none. */
  withoutAvgKcal: number
  differenceKcal: number
  daysWith: number
  daysWithout: number
}

/**
 * The single most useful context comparison, or null when there isn't enough
 * evidence to say anything honest.
 *
 * Compares whole DAYS, not meals: one restaurant meal usually reshapes the rest
 * of the day too, and a per-meal average would miss exactly the effect people
 * care about.
 */
export function contextInsight(logs: readonly ContextLog[]): ContextInsight | null {
  const dayKcal = new Map<string, number>()
  const dayContexts = new Map<string, Set<string>>()

  for (const log of logs) {
    const day = istKey(log.logged_at)
    dayKcal.set(day, (dayKcal.get(day) ?? 0) + (log.kcal ?? 0))
    if (isMealContext(log.context)) {
      const set = dayContexts.get(day) ?? new Set<string>()
      set.add(log.context)
      dayContexts.set(day, set)
    }
  }

  let best: ContextInsight | null = null

  for (const context of MEAL_CONTEXTS) {
    const withDays: number[] = []
    const withoutDays: number[] = []

    for (const [day, kcal] of dayKcal) {
      if (dayContexts.get(day)?.has(context)) withDays.push(kcal)
      else withoutDays.push(kcal)
    }

    if (withDays.length < MIN_DAYS_PER_SIDE || withoutDays.length < MIN_DAYS_PER_SIDE) continue

    const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)
    const withAvgKcal = mean(withDays)
    const withoutAvgKcal = mean(withoutDays)
    const differenceKcal = withAvgKcal - withoutAvgKcal

    if (Math.abs(differenceKcal) < MIN_KCAL_DIFFERENCE) continue

    // The biggest effect wins — one clear sentence beats four hedged ones.
    if (!best || Math.abs(differenceKcal) > Math.abs(best.differenceKcal)) {
      best = { context, withAvgKcal, withoutAvgKcal, differenceKcal, daysWith: withDays.length, daysWithout: withoutDays.length }
    }
  }

  return best
}

/** The share of tagged meals that were home-cooked, or null if none are tagged. */
export function homeCookedShare(logs: readonly ContextLog[]): number | null {
  const tagged = logs.filter((l) => isMealContext(l.context))
  if (tagged.length === 0) return null
  return tagged.filter((l) => l.context === 'home').length / tagged.length
}

/** One plain sentence for the insight, or null. */
export function contextInsightLine(insight: ContextInsight | null): string | null {
  if (!insight) return null
  const { context, differenceKcal } = insight
  const label = MEAL_CONTEXT_LABELS[context].label.toLowerCase()
  const amount = Math.abs(differenceKcal)
  return differenceKcal > 0
    ? `Days with a ${label} meal average ${amount} kcal more than the rest.`
    : `Days with a ${label} meal average ${amount} kcal less than the rest.`
}
