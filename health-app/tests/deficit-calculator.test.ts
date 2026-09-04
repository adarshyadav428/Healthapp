import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { istDateStr } from '../lib/dateUtils'
import {
  calculateWeeklyDeficit,
  calculatePeriodDeficit,
  buildWeekWindow,
  buildPeriodWindow,
  cumulativeSeries,
  weekStartOf,
  addDayKey,
  monthStartOf,
  addMonthKey,
  daysInMonth,
  groupKcalByIstDay,
} from '../lib/deficit-calculator'

const day = (date: string, calories: number) => ({ date, calories })

describe('calculateWeeklyDeficit', () => {
  const tdee = 2500

  it('computes total deficit as Σ(tdee − eaten)', () => {
    const s = calculateWeeklyDeficit(
      [day('2026-07-13', 2000), day('2026-07-14', 2200)],
      tdee,
      0.5
    )
    expect(s.total_deficit).toBe(500 + 300)
    expect(s.days_logged).toBe(2)
    expect(s.average_daily_deficit).toBe(400)
  })

  it('target deficit = weeklyGoalKg × 7700', () => {
    const s = calculateWeeklyDeficit([day('2026-07-13', 2000)], tdee, 0.5)
    expect(s.target_deficit).toBe(3850)
    expect(s.fat_loss_target_kg).toBe(0.5)
  })

  it('surplus week → status "surplus" and zero fat loss achieved', () => {
    const s = calculateWeeklyDeficit(
      [day('2026-07-13', 3000), day('2026-07-14', 3200)],
      tdee,
      0.5
    )
    expect(s.status).toBe('surplus')
    expect(s.total_deficit).toBeLessThan(0)
    expect(s.fat_loss_achieved_kg).toBe(0)
    expect(s.progress_percent).toBe(0) // clamped, never negative
  })

  it('≥110% of target → "ahead"', () => {
    // target 3850; 7 days × 700 = 4900 → 127% → clamps to 120
    const logs = Array.from({ length: 7 }, (_, i) => day(`2026-07-${13 + i}`, 1800))
    const s = calculateWeeklyDeficit(logs, tdee, 0.5)
    expect(s.status).toBe('ahead')
    expect(s.progress_percent).toBe(120)
  })

  it('80–110% of target → "on_track"', () => {
    // 7 × 500 = 3500 → 90.9% of 3850
    const logs = Array.from({ length: 7 }, (_, i) => day(`2026-07-${13 + i}`, 2000))
    const s = calculateWeeklyDeficit(logs, tdee, 0.5)
    expect(s.status).toBe('on_track')
  })

  it('below 80% → "behind" with catch-up insight', () => {
    const s = calculateWeeklyDeficit([day('2026-07-13', 2400)], tdee, 0.5)
    expect(s.status).toBe('behind')
    expect(s.insight).toContain('behind target')
  })

  it('handles an empty week without dividing by zero', () => {
    const s = calculateWeeklyDeficit([], tdee, 0.5)
    expect(s.days_logged).toBe(0)
    expect(s.average_daily_deficit).toBe(0)
    expect(s.total_deficit).toBe(0)
    expect(s.status).toBe('behind')
  })

  it('maintain goal (0 kg/week) never reports progress or divide-by-zero', () => {
    const s = calculateWeeklyDeficit([day('2026-07-13', 2000)], tdee, 0)
    expect(s.target_deficit).toBe(0)
    expect(s.progress_percent).toBe(0)
    expect(Number.isFinite(s.projected_weekly_loss_kg)).toBe(true)
  })

  it('projected weekly loss extrapolates the average daily deficit', () => {
    // avg 550/day → 3850/week → exactly 0.5 kg
    const s = calculateWeeklyDeficit([day('2026-07-13', 1950)], tdee, 0.5)
    expect(s.projected_weekly_loss_kg).toBe(0.5)
  })

  // ── Prorating: a partial week has to be winnable ──────────────────────────
  describe('prorated progress', () => {
    // 4 days, each exactly on the 550 kcal/day target.
    const fourGoodDays = Array.from({ length: 4 }, (_, i) => day(`2026-07-${13 + i}`, 1950))

    it('four perfect days out of seven reads 100%, not 57%', () => {
      const s = calculateWeeklyDeficit(fourGoodDays, tdee, 0.5, { daysElapsed: 7 })
      expect(s.total_deficit).toBe(2200)
      expect(s.prorated_target_deficit).toBe(2200)
      expect(s.progress_percent).toBe(100)
      expect(s.status).toBe('on_track')
      // 2200/3850 = 57% — what the old full-week yardstick reported.
      expect(s.target_deficit).toBe(3850)
    })

    it('names the unlogged gap instead of hiding it', () => {
      const s = calculateWeeklyDeficit(fourGoodDays, tdee, 0.5, { daysElapsed: 7 })
      expect(s.days_logged).toBe(4)
      expect(s.days_unlogged).toBe(3)
    })

    it('daysElapsed can never be fewer than the days actually logged', () => {
      const s = calculateWeeklyDeficit(fourGoodDays, tdee, 0.5, { daysElapsed: 2 })
      expect(s.days_unlogged).toBe(0)
    })

    it('defaults daysElapsed to the logged count, so no gap is invented', () => {
      const s = calculateWeeklyDeficit(fourGoodDays, tdee, 0.5)
      expect(s.days_unlogged).toBe(0)
      expect(s.progress_percent).toBe(100)
    })
  })

  // ── The caller contract that partial days break ───────────────────────────
  it('documents why today must be excluded: a 300 kcal morning reads as a 2,200 kcal win', () => {
    const s = calculateWeeklyDeficit([day('2026-07-13', 300)], tdee, 0.5)
    expect(s.total_deficit).toBe(2200)
    expect(s.progress_percent).toBe(120) // clamped — a fake "ahead of schedule"
  })

  it('accepts an explicit week_start when the caller knows the real Monday', () => {
    const s = calculateWeeklyDeficit([], tdee, 0.5, { weekStart: '2026-07-13' })
    expect(s.week_start).toBe('2026-07-13')
  })

  // ── Goals other than "lose" get real numbers, not a dead zero ─────────────
  describe('gain goal', () => {
    it('treats a surplus as on track and keeps the target non-zero', () => {
      // 275 kcal/day over maintenance = 0.25 kg/week gain
      const days = Array.from({ length: 7 }, (_, i) => day(`2026-07-${13 + i}`, 2775))
      const s = calculateWeeklyDeficit(days, tdee, 0.25, { goal: 'gain' })
      expect(s.target_deficit).toBe(-1925)
      expect(s.total_deficit).toBe(-1925)
      expect(s.progress_percent).toBe(100)
      expect(s.status).toBe('on_track')
      expect(s.insight).toContain('surplus')
    })

    it('flags eating below maintenance as the wrong direction', () => {
      const s = calculateWeeklyDeficit(
        [day('2026-07-13', 2000), day('2026-07-14', 2000)],
        tdee,
        0.25,
        { goal: 'gain' }
      )
      expect(s.status).toBe('surplus')
      expect(s.insight).toContain('below maintenance')
    })
  })

  describe('maintain goal', () => {
    it('scores days held near maintenance instead of reporting a permanent 0%', () => {
      const s = calculateWeeklyDeficit(
        [
          day('2026-07-13', 2450), // −50  → held
          day('2026-07-14', 2600), // +100 → held
          day('2026-07-15', 2500), // 0    → held
          day('2026-07-16', 2000), // −500 → not held
        ],
        tdee,
        0,
        { goal: 'maintain' }
      )
      expect(s.target_deficit).toBe(0)
      expect(s.progress_percent).toBe(75)
      expect(s.status).toBe('on_track')
      expect(s.insight).toContain('3 of 4')
    })

    it('says something useful with nothing logged', () => {
      const s = calculateWeeklyDeficit([], tdee, 0, { goal: 'maintain' })
      expect(s.progress_percent).toBe(0)
      expect(s.status).toBe('behind')
      expect(s.insight).toContain('Log a few days')
    })
  })
})

// ── The week window: where "today is never passed in" is enforced ───────────
describe('weekStartOf', () => {
  it('anchors every day to its Monday', () => {
    expect(weekStartOf('2026-07-13')).toBe('2026-07-13') // Monday itself
    expect(weekStartOf('2026-07-16')).toBe('2026-07-13') // Thursday
    expect(weekStartOf('2026-07-19')).toBe('2026-07-13') // Sunday, not the next Monday
    expect(weekStartOf('2026-07-20')).toBe('2026-07-20') // next Monday
  })
})

describe('addDayKey', () => {
  it('crosses month and year boundaries', () => {
    expect(addDayKey('2026-07-30', 3)).toBe('2026-08-02')
    expect(addDayKey('2026-01-01', -1)).toBe('2025-12-31')
  })
})

describe('groupKcalByIstDay', () => {
  it('buckets on the IST day boundary, not UTC', () => {
    const byDate = groupKcalByIstDay([
      { kcal: 100, logged_at: '2026-07-13T18:00:00Z' }, // 23:30 IST, 13th
      { kcal: 200, logged_at: '2026-07-13T19:00:00Z' }, // 00:30 IST, 14th
      { kcal: 50, logged_at: '2026-07-13T12:00:00Z' },  // 17:30 IST, 13th
    ])
    expect(byDate.get('2026-07-13')).toBe(150)
    expect(byDate.get('2026-07-14')).toBe(200)
  })
})

describe('buildWeekWindow', () => {
  // Thursday. Mon-Wed are finished; Tue was never logged; today is in progress.
  const today = '2026-07-16'
  const byDate = new Map([
    ['2026-07-13', 1950],
    ['2026-07-15', 1950],
    ['2026-07-16', 300], // today, half-eaten
  ])

  it('peels today off the completed days', () => {
    const w = buildWeekWindow(byDate, today)
    expect(w.weekStart).toBe('2026-07-13')
    expect(w.dates).toHaveLength(7)
    expect(w.completed.map((d) => d.date)).toEqual(['2026-07-13', '2026-07-15'])
    expect(w.todayKcal).toBe(300)
  })

  it('counts finished days, logged or not, so the gap can be named', () => {
    const w = buildWeekWindow(byDate, today)
    expect(w.daysElapsed).toBe(3) // Mon, Tue, Wed
    const s = calculateWeeklyDeficit(w.completed, 2500, 0.5, { daysElapsed: w.daysElapsed })
    expect(s.days_logged).toBe(2)
    expect(s.days_unlogged).toBe(1) // Tuesday
    // The two logged days were both on target, so the week reads as on target.
    expect(s.progress_percent).toBe(100)
  })

  it('today never reaches the deficit maths', () => {
    const w = buildWeekWindow(byDate, today)
    const s = calculateWeeklyDeficit(w.completed, 2500, 0.5, { daysElapsed: w.daysElapsed })
    // 2 × 550. Today's 300 kcal would have added a phantom 2,200.
    expect(s.total_deficit).toBe(1100)
  })

  it('reports null for today when nothing is logged yet', () => {
    const w = buildWeekWindow(new Map([['2026-07-13', 1950]]), today)
    expect(w.todayKcal).toBeNull()
  })

  it('on Monday there is nothing finished yet, and it says so honestly', () => {
    const w = buildWeekWindow(new Map([['2026-07-13', 400]]), '2026-07-13')
    expect(w.daysElapsed).toBe(0)
    expect(w.completed).toEqual([])
    expect(w.todayKcal).toBe(400)
  })

  it('weeksAgo walks back to a fully finished week', () => {
    const w = buildWeekWindow(byDate, today, 1)
    expect(w.weekStart).toBe('2026-07-06')
    expect(w.daysElapsed).toBe(7)
    expect(w.todayKcal).toBeNull()
  })
})

// ── Month periods: the same maths, a longer window ──────────────────────────
describe('month date helpers', () => {
  it('monthStartOf anchors any day to the 1st', () => {
    expect(monthStartOf('2026-08-22')).toBe('2026-08-01')
    expect(monthStartOf('2026-08-01')).toBe('2026-08-01')
  })

  it('addMonthKey crosses the year boundary in both directions', () => {
    expect(addMonthKey('2026-12-15', 1)).toBe('2027-01-01')
    expect(addMonthKey('2026-01-09', -1)).toBe('2025-12-01')
    expect(addMonthKey('2026-08-22', 0)).toBe('2026-08-01')
  })

  it('daysInMonth knows short months and non-leap Februaries', () => {
    expect(daysInMonth('2026-08-01')).toBe(31)
    expect(daysInMonth('2026-04-01')).toBe(30)
    expect(daysInMonth('2026-02-01')).toBe(28) // 2026 is not a leap year
    expect(daysInMonth('2028-02-01')).toBe(29)
  })
})

describe('buildPeriodWindow — month', () => {
  const today = '2026-08-22'
  const byDate = new Map([
    ['2026-07-31', 1900], // last month: must not leak in
    ['2026-08-01', 2000],
    ['2026-08-05', 1800],
    ['2026-08-22', 500],  // today, half-eaten
    ['2026-08-25', 1700], // future: impossible, but must not count if present
  ])

  it('spans the calendar month and stops at today', () => {
    const w = buildPeriodWindow(byDate, today, 'month')
    expect(w.periodStart).toBe('2026-08-01')
    expect(w.periodDays).toBe(31)
    expect(w.dates).toHaveLength(31)
    expect(w.daysElapsed).toBe(21) // Aug 1–21
    expect(w.completed.map((d) => d.date)).toEqual(['2026-08-01', '2026-08-05'])
    expect(w.todayKcal).toBe(500)
  })

  it('back = 1 walks to the previous, fully finished month', () => {
    const w = buildPeriodWindow(byDate, today, 'month', 1)
    expect(w.periodStart).toBe('2026-07-01')
    expect(w.periodDays).toBe(31)
    expect(w.daysElapsed).toBe(31)
    expect(w.completed.map((d) => d.date)).toEqual(['2026-07-31'])
    expect(w.todayKcal).toBeNull()
  })
})

// The Progress page's trend card opts into this on purpose — see the note atop
// lib/deficit-calculator.ts. `/deficit`'s week-by-week history never sets it.
describe('buildPeriodWindow — rolling', () => {
  const today = '2026-08-22' // a Saturday; the calendar week starts Mon 08-17
  const byDate = new Map([
    ['2026-07-24', 2100], // first day of the rolling 30-day window
    ['2026-08-09', 1900], // inside the rolling month, outside the rolling week
    ['2026-08-16', 2000], // first day of the rolling 7-day window
    ['2026-08-21', 1850],
    ['2026-08-22', 500],  // today, half-eaten
    ['2026-08-23', 1700], // future: impossible, but must not count if present
  ])

  it('week: trails 7 days ending today, not the calendar Mon–Sun window', () => {
    const w = buildPeriodWindow(byDate, today, 'week', 0, true)
    expect(w.periodStart).toBe('2026-08-16') // today − 6, not the Monday (08-17)
    expect(w.periodDays).toBe(7)
    expect(w.dates).toEqual([
      '2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19',
      '2026-08-20', '2026-08-21', '2026-08-22',
    ])
    expect(w.daysElapsed).toBe(6) // today still excluded, same rule as the calendar path
    expect(w.completed.map((d) => d.date)).toEqual(['2026-08-16', '2026-08-21'])
    expect(w.todayKcal).toBe(500)
  })

  it('week: back = 1 slides a full window earlier, not to the calendar-previous week', () => {
    const w = buildPeriodWindow(byDate, today, 'week', 1, true)
    expect(w.periodStart).toBe('2026-08-09')
    expect(w.daysElapsed).toBe(7)
    expect(w.completed.map((d) => d.date)).toEqual(['2026-08-09'])
    expect(w.todayKcal).toBeNull()
  })

  it('month: trails 30 days ending today, ignoring calendar month boundaries', () => {
    const w = buildPeriodWindow(byDate, today, 'month', 0, true)
    expect(w.periodStart).toBe('2026-07-24')
    expect(w.periodDays).toBe(30)
    expect(w.dates).toHaveLength(30)
    expect(w.daysElapsed).toBe(29)
    expect(w.completed.map((d) => d.date)).toEqual([
      '2026-07-24', '2026-08-09', '2026-08-16', '2026-08-21',
    ])
    expect(w.todayKcal).toBe(500)
  })

  it('leaves the default calendar path untouched', () => {
    const w = buildPeriodWindow(byDate, today, 'week')
    expect(w.periodStart).toBe('2026-08-17') // the Monday, not today − 6
  })
})

describe('calculatePeriodDeficit — month', () => {
  const tdee = 2500

  it('stretches the weekly pace across the month, so the target scales', () => {
    const s = calculatePeriodDeficit([day('2026-08-01', 2000)], tdee, 0.5, { periodDays: 31 })
    // 0.5 kg/week × 7,700 × (31/7)
    expect(s.target_deficit).toBe(17050)
    expect(s.fat_loss_target_kg).toBe(2.21)
    expect(s.period_days).toBe(31)
  })

  it('keeps the daily pace identical to the weekly window', () => {
    const week  = calculatePeriodDeficit([day('2026-08-01', 2000)], tdee, 0.5, { periodDays: 7 })
    const month = calculatePeriodDeficit([day('2026-08-01', 2000)], tdee, 0.5, { periodDays: 31 })
    // A month is not a harder standard per day — only a longer one.
    expect(month.prorated_target_deficit).toBe(week.prorated_target_deficit)
    expect(month.progress_percent).toBe(week.progress_percent)
  })

  it('a month of on-pace days reads on track, not behind', () => {
    const days = Array.from({ length: 21 }, (_, i) =>
      day(`2026-08-${String(i + 1).padStart(2, '0')}`, 1950) // 550/day, exactly on pace
    )
    const s = calculatePeriodDeficit(days, tdee, 0.5, { periodDays: 31, daysElapsed: 21 })
    expect(s.total_deficit).toBe(11550)
    expect(s.progress_percent).toBe(100)
    expect(s.status).toBe('on_track')
    expect(s.days_unlogged).toBe(0)
  })

  it('defaults to a seven-day period when none is given', () => {
    expect(calculatePeriodDeficit([], tdee, 0.5).period_days).toBe(7)
  })

  it('says "month", not "week", when the period is a month', () => {
    // Eating well over maintenance, so the surplus sentence fires.
    const days = Array.from({ length: 5 }, (_, i) => day(`2026-08-0${i + 1}`, 3200))
    const s = calculatePeriodDeficit(days, tdee, 0.5, { periodDays: 31, daysElapsed: 5 })
    expect(s.insight).toContain('this month')
    expect(s.insight).not.toContain('this week')
  })

  it('groups digits in the insight, so it matches the headline beside it', () => {
    const s = calculatePeriodDeficit([day('2026-08-01', 2400)], tdee, 1, { periodDays: 31, daysElapsed: 21 })
    expect(s.status).toBe('behind')
    // "11230 kcal" next to a headline reading "8,570" looks like a bug.
    expect(s.insight).toMatch(/\d,\d{3}/)
    expect(s.insight).not.toMatch(/\b\d{4,}\b/)
  })
})

describe('cumulativeSeries', () => {
  const tdee = 2500

  it('is a running sum of maintenance − eaten', () => {
    const s = cumulativeSeries(
      [day('2026-08-01', 2000), day('2026-08-02', 2200), day('2026-08-03', 1500)],
      tdee
    )
    expect(s.map((d) => d.deficit)).toEqual([500, 300, 1000])
    expect(s.map((d) => d.cumulative)).toEqual([500, 800, 1800])
  })

  it('a heavy day bends the line down without erasing what came before', () => {
    const s = cumulativeSeries(
      [day('2026-08-01', 2000), day('2026-08-02', 3500), day('2026-08-03', 2000)],
      tdee
    )
    expect(s.map((d) => d.cumulative)).toEqual([500, -500, 0])
    // The dip is visible, but Monday's work is still in the total.
    expect(s[1].deficit).toBe(-1000)
  })

  it('handles an empty period', () => {
    expect(cumulativeSeries([], tdee)).toEqual([])
  })
})

/**
 * The last UTC day helper in the deficit module.
 *
 * `period_start` fell back to `new Date().toISOString().slice(0, 10)` — a UTC
 * calendar date, which between 00:00 and 05:30 IST names yesterday — inside the
 * one module CLAUDE.md says has no UTC day helper left. All three callers pass
 * a start, so it was unreachable; it is fixed anyway, because a latent
 * wrong-day fallback is what a fourth caller reaches after trusting the file's
 * header (audit 2026-09-03, P2-7).
 */
describe('period_start falls back to the IST day, not the UTC day', () => {
  it('uses the IST date when nothing supplies a start', () => {
    const summary = calculateWeeklyDeficit([], 2000, 0.5)
    expect(summary.period_start).toBe(istDateStr())
    expect(summary.week_start).toBe(istDateStr())
  })

  it('still prefers an explicit start over the fallback', () => {
    const summary = calculateWeeklyDeficit([], 2000, 0.5, { weekStart: '2026-01-05' })
    expect(summary.period_start).toBe('2026-01-05')
  })

  it('the module never reads NOW as a UTC day', () => {
    const src = readFileSync(join(__dirname, '..', 'lib', 'deficit-calculator.ts'), 'utf8')
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
    // Narrow on purpose. `weekStartOf` and `addDayKey` also end in
    // `.toISOString().slice(0, 10)`, and they are correct: they parse a
    // YYYY-MM-DD key as UTC midnight, do UTC arithmetic and format back — a
    // synthetic date standing in for an IST calendar date, which never drifts.
    // `new Date()` with no argument is the different thing: it reads the
    // current instant, and only then does the zone decide the answer.
    expect(stripped).not.toMatch(/new Date\(\)\.toISOString\(\)\.slice\(/)
  })
})
