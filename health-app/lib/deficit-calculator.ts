/**
 * lib/deficit-calculator.ts
 *
 * The single definition of "deficit" in the app. Every screen that shows one
 * reads it from here.
 *
 * Science:
 *   1 kg of fat = 7,700 kcal
 *   Daily deficit = maintenance (TDEE) - calories eaten
 *   Period target deficit = pace_kg_per_week × 7,700 × (periodDays / 7)
 *
 * Periods default to *calendar* windows — Mon–Sun, or the 1st to the end of the
 * month. A calendar total only ever grows and then resets, so it cannot fall for
 * a reason the user did not cause. A rolling total drops whenever a good day ages
 * out of the back of the window, which reads as punishment for nothing — that's
 * why `/deficit`'s week-by-week history stays calendar-only.
 *
 * `buildPeriodWindow`'s `rolling` flag is a deliberate, narrow exception: the
 * Progress page's "Week"/"Month" trend card (`buildDeficitView` in
 * `app/progress/page.tsx`) trades that guarantee on purpose, because its ask is
 * "the last 7/30 days" rather than "this calendar period." Callers that opt in
 * accept the trade-off above; nothing else in the app should.
 *
 * Two rules the callers must honour, both learned from bugs:
 *
 *  1. **Today is never passed in.** A day in progress has only breakfast in it,
 *     so `tdee - eaten` reads as a ~1,900 kcal triumph at 9am and shrinks with
 *     every honest log. Pass completed days only; render today separately.
 *  2. **Unlogged days are named, not silently dropped.** Progress is measured
 *     against `dailyTarget × daysLogged`, so four good days out of seven reads
 *     100%, not 57%. `days_unlogged` carries the gap so the UI can say it out
 *     loud and the number is never mistaken for a full week.
 */

import { KCAL_PER_KG_FAT } from './tdee'
import { istDateStr } from './dateUtils'

/** A maintain-goal day counts as held if it lands within this of maintenance. */
export const MAINTAIN_TOLERANCE_KCAL = 200

const DAY_MS = 86_400_000

/** Roll raw food logs into per-IST-day kcal totals. IST is the app's day boundary. */
export function groupKcalByIstDay(logs: { kcal: number; logged_at: string }[]): Map<string, number> {
  const byDate = new Map<string, number>()
  for (const log of logs) {
    const date = istDateStr(new Date(log.logged_at))
    byDate.set(date, (byDate.get(date) ?? 0) + log.kcal)
  }
  return byDate
}

/** The Monday of the week containing `dateKey` (weeks run Mon–Sun). */
export function weekStartOf(dateKey: string): string {
  const d = new Date(dateKey + 'T00:00:00Z')
  const dow = d.getUTCDay()
  return new Date(d.getTime() - (dow === 0 ? 6 : dow - 1) * DAY_MS).toISOString().slice(0, 10)
}

/** `n` days after `dateKey`, as a YYYY-MM-DD key. */
export function addDayKey(dateKey: string, n: number): string {
  return new Date(new Date(dateKey + 'T00:00:00Z').getTime() + n * DAY_MS).toISOString().slice(0, 10)
}

/** The 1st of the month containing `dateKey`. */
export function monthStartOf(dateKey: string): string {
  return dateKey.slice(0, 8) + '01'
}

/** The 1st of the month `n` months from the one containing `dateKey`. */
export function addMonthKey(dateKey: string, n: number): string {
  const [y, m] = dateKey.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`
}

/** Day 0 of the following month is the last day of this one — 28, 29, 30 or 31. */
export function daysInMonth(dateKey: string): number {
  const [y, m] = dateKey.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Calendar periods, never rolling: a total that only grows, then resets. */
export type PeriodKind = 'week' | 'month'

export type PeriodWindow = {
  periodStart: string
  periodDays: number
  /** Every date in the period, in order — including days still to come. */
  dates: string[]
  /** Logged days that have finished. This is what `calculatePeriodDeficit` takes. */
  completed: { date: string; calories: number }[]
  /** Finished days in the period, logged or not — the denominator for the gap. */
  daysElapsed: number
  /** Today's running total, or null if nothing is logged yet. Never a "deficit". */
  todayKcal: number | null
  /** Alias of `periodStart`, kept so week-shaped callers read naturally. */
  weekStart: string
}

/** @deprecated Use `PeriodWindow`. */
export type WeekWindow = PeriodWindow

/**
 * Split a calendar period into "finished" and "in progress".
 *
 * This is the guard rail for the contract above: today is peeled off here, once,
 * so no screen has to remember to do it. Every deficit surface builds its window
 * through this function.
 *
 * `back` walks whole periods into the past — `1` is last week / last month. That
 * is what the card falls back to on a Monday, when nothing has finished yet.
 *
 * `rolling` swaps the calendar anchor for a trailing N-day window ending today
 * (7 days for 'week', 30 for 'month'), sliding by its own length for `back` —
 * see the file header for why this is opt-in and narrow.
 */
export function buildPeriodWindow(
  byDate: Map<string, number>,
  todayStr: string,
  kind: PeriodKind = 'week',
  back = 0,
  rolling = false
): PeriodWindow {
  let periodStart: string
  let periodDays: number

  if (rolling) {
    periodDays = kind === 'month' ? 30 : 7
    const windowEnd = addDayKey(todayStr, -periodDays * back)
    periodStart = addDayKey(windowEnd, -(periodDays - 1))
  } else {
    periodStart = kind === 'month'
      ? addMonthKey(monthStartOf(todayStr), -back)
      : addDayKey(weekStartOf(todayStr), -back * 7)
    periodDays = kind === 'month' ? daysInMonth(periodStart) : 7
  }

  const dates = Array.from({ length: periodDays }, (_, i) => addDayKey(periodStart, i))
  const finished = dates.filter((d) => d < todayStr)
  const completed = finished
    .filter((d) => byDate.has(d))
    .map((d) => ({ date: d, calories: Math.round(byDate.get(d) ?? 0) }))
  const todayRaw = byDate.get(todayStr)

  return {
    periodStart,
    weekStart: periodStart,
    periodDays,
    dates,
    completed,
    daysElapsed: finished.length,
    todayKcal: dates.includes(todayStr) && todayRaw != null ? Math.round(todayRaw) : null,
  }
}

/** The seven-day case. Kept because most callers only ever want a week. */
export function buildWeekWindow(byDate: Map<string, number>, todayStr: string, weeksAgo = 0): PeriodWindow {
  return buildPeriodWindow(byDate, todayStr, 'week', weeksAgo)
}

/**
 * The running total, day by day — the shape the cumulative chart draws.
 *
 * This is the user's own formula made literal: each day adds `maintenance − eaten`
 * to a total that climbs, and a heavy day bends it back down without erasing what
 * came before.
 */
export function cumulativeSeries(
  completedDays: { date: string; calories: number }[],
  tdee: number
): { date: string; deficit: number; cumulative: number }[] {
  let running = 0
  return completedDays.map((d) => {
    const deficit = tdee - d.calories
    running += deficit
    return { date: d.date, deficit: Math.round(deficit), cumulative: Math.round(running) }
  })
}

export interface DailyDeficit {
  date: string
  calories_eaten: number
  tdee: number
  deficit: number            // positive = deficit, negative = surplus
  cumulative_deficit: number
}

export interface WeeklyDeficitSummary {
  period_start: string
  /** 7 for a week, 28–31 for a month. Everything below scales off this. */
  period_days: number
  /** Alias of `period_start`, kept so week-shaped callers read naturally. */
  week_start: string
  total_deficit: number
  /** The full seven-day target. Context, not the yardstick — see below. */
  target_deficit: number
  /** `target_deficit ÷ 7 × days_logged` — what progress is actually measured against. */
  prorated_target_deficit: number
  fat_loss_achieved_kg: number
  fat_loss_target_kg: number
  /** Measured against `prorated_target_deficit`, so a partial week is reachable. */
  progress_percent: number
  days_logged: number
  /** Completed days in the window with no logs. The gap, named. */
  days_unlogged: number
  average_daily_deficit: number
  projected_weekly_loss_kg: number
  status: 'on_track' | 'ahead' | 'behind' | 'surplus'
  insight: string
}

type Goal = 'lose' | 'maintain' | 'gain'

export interface WeeklyDeficitOptions {
  /** Length of the window: 7 for a week, 28–31 for a month. Defaults to 7. */
  periodDays?: number
  /** Completed days in the window, logged or not. Defaults to the logged count. */
  daysElapsed?: number
  /** Defaults to 'lose'. Flips the vocabulary — a surplus is the point when gaining. */
  goal?: Goal
  /** The window's first date, when the caller knows it (e.g. the real Monday). */
  periodStart?: string
  /** @deprecated Alias of `periodStart`. */
  weekStart?: string
}

/**
 * One period's worth of deficit. `periodDays` is the only thing that separates a
 * week from a month — the target, the daily pace and the countdown all scale off
 * it, so neither period can drift from the other.
 */
export function calculatePeriodDeficit(
  completedDays: { date: string; calories: number }[],
  tdee: number,
  weeklyGoalKg: number,
  opts: WeeklyDeficitOptions = {}
): WeeklyDeficitSummary {
  const goal: Goal = opts.goal ?? 'lose'
  const periodDays = opts.periodDays ?? 7
  const daysLogged = completedDays.length
  const daysElapsed = Math.max(opts.daysElapsed ?? daysLogged, daysLogged)
  const daysUnlogged = Math.max(0, daysElapsed - daysLogged)
  // Days left in the period — "hasn't happened yet", not "wasn't logged". The old
  // code conflated the two and told people to catch up on days they had already
  // lived through.
  const daysRemaining = Math.max(0, periodDays - daysElapsed)

  // Gaining aims *below* maintenance-neutral: the target deficit is negative, so
  // the same ratio maths reads "on track" for a surplus without a special case.
  const signedGoalKg = goal === 'gain' ? -Math.abs(weeklyGoalKg) : Math.abs(weeklyGoalKg)
  // The pace is quoted per week, so a month's target is that pace stretched over
  // however many days the month actually has.
  const targetDeficit = goal === 'maintain' ? 0 : signedGoalKg * KCAL_PER_KG_FAT * (periodDays / 7)
  const targetDailyDeficit = targetDeficit / periodDays
  const proratedTarget = targetDailyDeficit * daysLogged
  const periodGoalKg = Math.round(weeklyGoalKg * (periodDays / 7) * 100) / 100

  let totalDeficit = 0
  const dailyDeficits: DailyDeficit[] = []

  for (const log of completedDays) {
    const dayDeficit = tdee - log.calories
    totalDeficit += dayDeficit
    dailyDeficits.push({
      date: log.date,
      calories_eaten: log.calories,
      tdee,
      deficit: dayDeficit,
      cumulative_deficit: totalDeficit,
    })
  }

  const avgDailyDeficit = daysLogged > 0 ? totalDeficit / daysLogged : 0
  const projectedWeeklyLoss = (avgDailyDeficit * 7) / KCAL_PER_KG_FAT
  const fatLossAchieved = Math.max(0, totalDeficit / KCAL_PER_KG_FAT)

  // Maintaining has no target gap to close, so progress is "how many days did you
  // hold near maintenance" — a real answer instead of a permanent zero.
  const daysHeld = goal === 'maintain'
    ? completedDays.filter((d) => Math.abs(tdee - d.calories) <= MAINTAIN_TOLERANCE_KCAL).length
    : 0

  const progressPercent = goal === 'maintain'
    ? (daysLogged > 0 ? (daysHeld / daysLogged) * 100 : 0)
    : (proratedTarget !== 0 ? Math.min(120, (totalDeficit / proratedTarget) * 100) : 0)

  let status: WeeklyDeficitSummary['status']
  if (goal === 'maintain') {
    status = daysLogged > 0 && progressPercent >= 70 ? 'on_track' : 'behind'
  } else if (proratedTarget !== 0 && totalDeficit / proratedTarget < 0) {
    // Moving the wrong way: over maintenance while losing, under it while gaining.
    status = 'surplus'
  } else if (totalDeficit < 0 && goal === 'lose') {
    status = 'surplus'
  } else if (progressPercent >= 110) {
    status = 'ahead'
  } else if (progressPercent >= 80) {
    status = 'on_track'
  } else {
    status = 'behind'
  }

  const calBehind = Math.max(0, Math.abs(proratedTarget) - Math.abs(totalDeficit))
  const neededPerDay = Math.round(calBehind / Math.max(1, daysRemaining))
  const kcalPerDay = Math.round(Math.abs(avgDailyDeficit))
  const dayWord = daysLogged === 1 ? 'day' : 'days'
  // The card renders every other number with Indian digit grouping; an insight
  // reading "11230 kcal" beside a headline reading "8,570" looks like a defect.
  const n = (v: number) => Math.round(v).toLocaleString('en-IN')
  // The same sentences serve a month, so they cannot say "this week".
  const periodWord = periodDays > 7 ? 'month' : 'week'

  let insight: string
  if (goal === 'maintain') {
    insight = daysLogged === 0
      ? 'Log a few days and we can show how close you are holding to maintenance.'
      : `You held within ${MAINTAIN_TOLERANCE_KCAL} kcal of maintenance on ${daysHeld} of ${daysLogged} logged ${dayWord}.`
  } else if (goal === 'gain') {
    insight =
      status === 'surplus'  ? `You are eating below maintenance this ${periodWord}. Add ${n(kcalPerDay)} kcal/day to gain as planned.`
      : status === 'ahead'    ? `Ahead of your gain pace — ${Math.abs(projectedWeeklyLoss).toFixed(2)} kg/week at this rate.`
      : status === 'on_track' ? `On track! Hold your ${n(Math.abs(targetDailyDeficit))} kcal/day surplus to hit your ${periodGoalKg} kg goal.`
      : `${n(calBehind)} kcal behind target. Add ${n(neededPerDay)} kcal each remaining day to hit your goal.`
  } else {
    insight =
      status === 'surplus'  ? `You are in a calorie surplus this ${periodWord}. Cut ${n(kcalPerDay)} kcal/day to get back on track.`
      : status === 'ahead'    ? `You are ahead of schedule — ${projectedWeeklyLoss.toFixed(2)} kg of fat loss per week at this pace. Keep it up!`
      : status === 'on_track' ? `On track! Maintain your ${n(targetDailyDeficit)} kcal/day deficit to hit your ${periodGoalKg} kg goal.`
      : `${n(calBehind)} kcal behind target. Need a ${n(neededPerDay)} kcal deficit each remaining day to hit your goal.`
  }

  const periodStart =
    opts.periodStart ?? opts.weekStart ?? completedDays[0]?.date ?? new Date().toISOString().slice(0, 10)

  return {
    period_start: periodStart,
    period_days: periodDays,
    week_start: periodStart,
    total_deficit: Math.round(totalDeficit),
    target_deficit: Math.round(targetDeficit),
    prorated_target_deficit: Math.round(proratedTarget),
    fat_loss_achieved_kg: Math.round(fatLossAchieved * 1000) / 1000,
    fat_loss_target_kg: periodGoalKg,
    progress_percent: Math.round(Math.max(0, progressPercent)),
    days_logged: daysLogged,
    days_unlogged: daysUnlogged,
    average_daily_deficit: Math.round(avgDailyDeficit),
    projected_weekly_loss_kg: Math.round(projectedWeeklyLoss * 1000) / 1000,
    status,
    insight,
  }
}

/** The seven-day case, which is what most callers mean. */
export function calculateWeeklyDeficit(
  completedDays: { date: string; calories: number }[],
  tdee: number,
  weeklyGoalKg: number,
  opts: WeeklyDeficitOptions = {}
): WeeklyDeficitSummary {
  return calculatePeriodDeficit(completedDays, tdee, weeklyGoalKg, { ...opts, periodDays: 7 })
}
