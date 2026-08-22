import { describe, it, expect } from 'vitest'
import {
  calculateWeeklyDeficit,
  buildWeekWindow,
  weekStartOf,
  addDayKey,
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
