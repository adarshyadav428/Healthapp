/**
 * lib/deficit-calculator.ts
 *
 * The single definition of "deficit" in the app. Every screen that shows one
 * reads it from here.
 *
 * Science:
 *   1 kg of fat = 7,700 kcal
 *   Daily deficit = maintenance (TDEE) - calories eaten
 *   Weekly target deficit = pace_kg_per_week × 7,700
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

export type WeekWindow = {
  weekStart: string
  /** All seven dates of the week, Monday first — including days still to come. */
  dates: string[]
  /** Logged days that have finished. This is what `calculateWeeklyDeficit` takes. */
  completed: { date: string; calories: number }[]
  /** Finished days in the week, logged or not — the denominator for the gap. */
  daysElapsed: number
  /** Today's running total, or null if nothing is logged yet. Never a "deficit". */
  todayKcal: number | null
}

/**
 * Split a week into "finished" and "in progress".
 *
 * This is the guard rail for the contract above: today is peeled off here, once,
 * so no screen has to remember to do it. Every deficit surface builds its week
 * through this function.
 */
export function buildWeekWindow(byDate: Map<string, number>, todayStr: string, weeksAgo = 0): WeekWindow {
  const weekStart = addDayKey(weekStartOf(todayStr), -weeksAgo * 7)
  const dates = Array.from({ length: 7 }, (_, i) => addDayKey(weekStart, i))
  const finished = dates.filter((d) => d < todayStr)
  const completed = finished
    .filter((d) => byDate.has(d))
    .map((d) => ({ date: d, calories: Math.round(byDate.get(d) ?? 0) }))
  const todayRaw = byDate.get(todayStr)
  return {
    weekStart,
    dates,
    completed,
    daysElapsed: finished.length,
    todayKcal: dates.includes(todayStr) && todayRaw != null ? Math.round(todayRaw) : null,
  }
}

export interface DailyDeficit {
  date: string
  calories_eaten: number
  tdee: number
  deficit: number            // positive = deficit, negative = surplus
  cumulative_deficit: number
}

export interface WeeklyDeficitSummary {
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
  /** Completed days in the window, logged or not. Defaults to the logged count. */
  daysElapsed?: number
  /** Defaults to 'lose'. Flips the vocabulary — a surplus is the point when gaining. */
  goal?: Goal
  /** The window's first date, when the caller knows it (e.g. the real Monday). */
  weekStart?: string
}

export function calculateWeeklyDeficit(
  completedDays: { date: string; calories: number }[],
  tdee: number,
  weeklyGoalKg: number,
  opts: WeeklyDeficitOptions = {}
): WeeklyDeficitSummary {
  const goal: Goal = opts.goal ?? 'lose'
  const daysLogged = completedDays.length
  const daysElapsed = Math.max(opts.daysElapsed ?? daysLogged, daysLogged)
  const daysUnlogged = Math.max(0, daysElapsed - daysLogged)
  // Days left in the week — "hasn't happened yet", not "wasn't logged". The old
  // code conflated the two and told people to catch up on days they had already
  // lived through.
  const daysRemaining = Math.max(0, 7 - daysElapsed)

  // Gaining aims *below* maintenance-neutral: the target deficit is negative, so
  // the same ratio maths reads "on track" for a surplus without a special case.
  const signedGoalKg = goal === 'gain' ? -Math.abs(weeklyGoalKg) : Math.abs(weeklyGoalKg)
  const targetDeficit = goal === 'maintain' ? 0 : signedGoalKg * KCAL_PER_KG_FAT
  const targetDailyDeficit = targetDeficit / 7
  const proratedTarget = targetDailyDeficit * daysLogged

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

  let insight: string
  if (goal === 'maintain') {
    insight = daysLogged === 0
      ? 'Log a few days and we can show how close you are holding to maintenance.'
      : `You held within ${MAINTAIN_TOLERANCE_KCAL} kcal of maintenance on ${daysHeld} of ${daysLogged} logged ${dayWord}.`
  } else if (goal === 'gain') {
    insight =
      status === 'surplus'  ? `You are eating below maintenance this week. Add ${kcalPerDay} kcal/day to gain as planned.`
      : status === 'ahead'    ? `Ahead of your gain pace — ${Math.abs(projectedWeeklyLoss).toFixed(2)} kg projected this week.`
      : status === 'on_track' ? `On track! Hold your ${Math.abs(Math.round(targetDailyDeficit))} kcal/day surplus to hit your ${weeklyGoalKg} kg goal.`
      : `${Math.round(calBehind)} kcal behind target. Add ${neededPerDay} kcal each remaining day to hit your goal.`
  } else {
    insight =
      status === 'surplus'  ? `You are in a calorie surplus this week. Cut ${kcalPerDay} kcal/day to get back on track.`
      : status === 'ahead'    ? `You are ahead of schedule — ${projectedWeeklyLoss.toFixed(2)} kg of fat loss projected this week. Keep it up!`
      : status === 'on_track' ? `On track! Maintain your ${Math.round(targetDailyDeficit)} kcal/day deficit to hit your ${weeklyGoalKg} kg goal.`
      : `${Math.round(calBehind)} kcal behind target. Need a ${neededPerDay} kcal deficit each remaining day to hit your goal.`
  }

  return {
    week_start: opts.weekStart ?? completedDays[0]?.date ?? new Date().toISOString().slice(0, 10),
    total_deficit: Math.round(totalDeficit),
    target_deficit: Math.round(targetDeficit),
    prorated_target_deficit: Math.round(proratedTarget),
    fat_loss_achieved_kg: Math.round(fatLossAchieved * 1000) / 1000,
    fat_loss_target_kg: weeklyGoalKg,
    progress_percent: Math.round(Math.max(0, progressPercent)),
    days_logged: daysLogged,
    days_unlogged: daysUnlogged,
    average_daily_deficit: Math.round(avgDailyDeficit),
    projected_weekly_loss_kg: Math.round(projectedWeeklyLoss * 1000) / 1000,
    status,
    insight,
  }
}
