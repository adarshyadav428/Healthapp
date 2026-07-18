/**
 * Weight trend — the smoothed line and the honest projection behind it.
 *
 * Raw weigh-ins are noisy: a bowl of dal, a salty meal, or the time of day
 * moves the scale by more than a good week of fat loss. Showing someone the
 * raw series and calling it progress is why people quit on a Tuesday. The
 * moving average is the number that actually answers "am I moving?".
 *
 * Pure so it's unit-testable (tests/weightTrend.test.ts).
 */

/** Below this many distinct days there is no trend, only noise. */
export const MIN_DAYS_FOR_TREND = 14
/** Smoothing window. Four weeks is long enough to swamp water-weight swings. */
export const TREND_WINDOW_DAYS = 28

export type WeighIn = { weight_kg: number; measured_at: string }
export type TrendPoint = { date: string; raw: number; average: number }

export type WeightTrend = {
  points: TrendPoint[]
  /** kg per week, negative when losing. Null when the span is too short. */
  kgPerWeek: number | null
  /** Projected date of reaching the target, or null when it doesn't apply. */
  projectedDate: Date | null
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * @param weighIns  any order; one per day is assumed after de-duplication
 * @param targetKg  goal weight, used only for the projection
 */
export function computeWeightTrend(weighIns: WeighIn[], targetKg: number | null): WeightTrend {
  // One weigh-in per calendar day (the last of that day wins) so a day someone
  // stepped on the scale three times doesn't get triple weight in the average.
  const byDay = new Map<string, { date: string; weight: number; t: number }>()
  for (const w of weighIns) {
    const t = new Date(w.measured_at).getTime()
    if (!Number.isFinite(t) || !Number.isFinite(w.weight_kg)) continue
    const date = new Date(t).toISOString().slice(0, 10)
    const prev = byDay.get(date)
    if (!prev || t >= prev.t) byDay.set(date, { date, weight: w.weight_kg, t })
  }

  const series = [...byDay.values()].sort((a, b) => a.t - b.t)
  if (series.length === 0) return { points: [], kgPerWeek: null, projectedDate: null }

  // Trailing average over the window, by time rather than by sample count —
  // weighing in twice this week and once last week should not skew the window.
  const points: TrendPoint[] = series.map((point, i) => {
    const windowStart = point.t - TREND_WINDOW_DAYS * DAY_MS
    let sum = 0
    let n = 0
    for (let j = i; j >= 0; j--) {
      if (series[j].t < windowStart) break
      sum += series[j].weight
      n += 1
    }
    return { date: point.date, raw: point.weight, average: +(sum / n).toFixed(2) }
  })

  // A rate needs a real span, not just a lot of samples in one week.
  // `spanDays` is elapsed time (the correct divisor for a rate); the gate uses
  // the inclusive day count, since 14 daily weigh-ins *cover* 14 days even
  // though only 13 have elapsed between the first and last.
  const spanDays = (series[series.length - 1].t - series[0].t) / DAY_MS
  const coveredDays = spanDays + 1
  if (series.length < MIN_DAYS_FOR_TREND || coveredDays < MIN_DAYS_FOR_TREND) {
    return { points, kgPerWeek: null, projectedDate: null }
  }

  // Rate from the smoothed ends, so one heavy final weigh-in can't set the
  // slope of the whole projection.
  const first = points[0].average
  const last = points[points.length - 1].average
  const kgPerWeek = +(((last - first) / spanDays) * 7).toFixed(3)

  const projectedDate = projectFrom(last, targetKg, kgPerWeek)
  return { points, kgPerWeek, projectedDate }
}

/**
 * When the current rate would reach the target. Null when the target is already
 * met, the rate is flat, or the trend points away from the goal — projecting a
 * date you are moving away from would be a lie dressed as encouragement.
 */
function projectFrom(currentKg: number, targetKg: number | null, kgPerWeek: number): Date | null {
  if (targetKg == null || !Number.isFinite(targetKg)) return null
  const remaining = targetKg - currentKg
  if (Math.abs(remaining) < 0.1) return null
  // Same sign required: losing (negative rate) toward a lower target.
  if (Math.sign(remaining) !== Math.sign(kgPerWeek)) return null
  if (Math.abs(kgPerWeek) < 0.01) return null

  const weeks = remaining / kgPerWeek
  // Beyond a couple of years the number stops being meaningful.
  if (weeks <= 0 || weeks > 104) return null
  return new Date(Date.now() + weeks * 7 * DAY_MS)
}
