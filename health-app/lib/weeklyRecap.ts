// Pure logic for the weekly recap (Sunday). The cron computes stats from the
// last 7 IST days, generates a message, stores a row and sends a push; the Pro
// dashboard card reads the stored row. Kept pure so tests pin the math.

export type RecapStats = {
  daysLogged: number
  avgKcal: number
  /** end − start over the window, to 1 dp; null when < 2 weigh-ins. */
  weightDeltaKg: number | null
}

/** Compute recap stats from per-day kcal totals (one entry per logged day) and
 *  the first/last weigh-ins in the window. */
export function computeRecapStats(
  dayKcals: number[],
  weightStartKg: number | null,
  weightEndKg: number | null
): RecapStats {
  const logged = dayKcals.filter((k) => k > 0)
  const daysLogged = logged.length
  const avgKcal = daysLogged ? Math.round(logged.reduce((a, b) => a + b, 0) / daysLogged) : 0
  const weightDeltaKg =
    weightStartKg != null && weightEndKg != null
      ? Math.round((weightEndKg - weightStartKg) * 10) / 10
      : null
  return { daysLogged, avgKcal, weightDeltaKg }
}

/**
 * A warm, honest one-liner derived from the stats — the deterministic fallback
 * used when the AI call is unavailable, and the template the AI prompt echoes.
 */
export function recapFallbackMessage(stats: RecapStats, firstName?: string): string {
  const who = firstName ? `${firstName}, ` : ''
  if (stats.daysLogged === 0) {
    return `${who}a fresh week ahead — log a meal today to get your streak going. 🌱`.replace(/^./, (c) => c.toUpperCase())
  }
  const consistency =
    stats.daysLogged >= 6 ? 'Brilliant consistency this week' :
    stats.daysLogged >= 3 ? 'Solid week of logging' :
    'A start is a start'

  let weightBit = ''
  if (stats.weightDeltaKg != null) {
    if (stats.weightDeltaKg < 0) weightBit = ` You're down ${Math.abs(stats.weightDeltaKg)} kg — keep it going.`
    else if (stats.weightDeltaKg > 0) weightBit = ` Weight nudged up ${stats.weightDeltaKg} kg — a steady week resets it.`
    else weightBit = ' Weight held steady.'
  }
  return `${who}${consistency}: ${stats.daysLogged} days logged, averaging ${stats.avgKcal.toLocaleString('en-IN')} kcal.${weightBit}`
}

/** The window's IST start date (YYYY-MM-DD), 6 days before `todayStr`. */
export function recapWeekStart(todayStr: string): string {
  const [y, m, d] = todayStr.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, d - 6))
  return [
    start.getUTCFullYear(),
    String(start.getUTCMonth() + 1).padStart(2, '0'),
    String(start.getUTCDate()).padStart(2, '0'),
  ].join('-')
}
