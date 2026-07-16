import { describe, it, expect } from 'vitest'
import { calculateWeeklyDeficit } from '../lib/deficit-calculator'

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
})
