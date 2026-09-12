// @vitest-environment jsdom
/**
 * WeightHero — the primary metric on Progress.
 *
 * `weightSummary` repeats WeightStats' arithmetic on purpose (the two surfaces
 * must agree), so the numbers are pinned here against a fixture a person can
 * check by hand: 80 → 74.4 on the way to 70 is 5.6 lost, 4.4 to go, 56%.
 * Rendered assertions go by role/text only, never by markup.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Profile, WeightLog } from '../../types/index'
import { WeightHero, weightSummary } from '../../components/progress/WeightHero'

// recharts needs a measured container; the chart is not what this test is about.
vi.mock('../../components/progress/WeightTrendChart', () => ({
  WeightTrendChart: () => <div data-testid="chart" />,
}))

const PROFILE = {
  id: 'u1',
  goal: 'lose',
  start_weight_kg: 80,
  current_weight_kg: 76,
  target_weight_kg: 70,
  height_cm: 170,
} as unknown as Profile

const log = (id: string, kg: number, day: number): WeightLog =>
  ({ id, user_id: 'u1', weight_kg: kg, measured_at: `2026-09-${String(day).padStart(2, '0')}T02:00:00Z`, notes: null }) as unknown as WeightLog

// Newest first, as app/progress/page.tsx fetches them.
const LOGS = [log('a', 74.4, 10), log('b', 75.1, 5), log('c', 76.2, 1)]

const NO_TREND = { points: [], kgPerWeek: null, projectedDate: null }

describe('weightSummary', () => {
  it('measures from the onboarding baseline, not the oldest weigh-in', () => {
    const s = weightSummary(LOGS, PROFILE)
    expect(s.current).toBe(74.4)
    expect(s.starting).toBe(80)
    expect(s.delta).toBe(-5.6)
    expect(s.toTarget).toBe(4.4)
    expect(Math.round(s.progress)).toBe(56)
  })

  it('falls back to the oldest weigh-in when there is no baseline', () => {
    const s = weightSummary(LOGS, { ...PROFILE, start_weight_kg: null } as unknown as Profile)
    expect(s.starting).toBe(76.2)
  })

  it('reads the profile weight when nothing has been logged', () => {
    const s = weightSummary([], PROFILE)
    expect(s.current).toBe(76)
    expect(s.progress).toBe(40)
  })

  it('survives the string numerics PostgREST actually sends', () => {
    const s = weightSummary(
      [{ ...LOGS[0], weight_kg: '74.40000000000000000000' as unknown as number }],
      { ...PROFILE, start_weight_kg: '80.00000000000000000000', target_weight_kg: '70.00000000000000000000' } as unknown as Profile,
    )
    expect(s.delta).toBe(-5.6)
    expect(Math.round(s.progress)).toBe(56)
  })
})

describe('WeightHero', () => {
  it('leads with the current weight and says what changed', () => {
    render(<WeightHero weightLogs={LOGS} profile={PROFILE} trend={NO_TREND} />)
    expect(screen.getByText('74.4')).toBeInTheDocument()
    expect(screen.getByText('5.6 kg lost')).toBeInTheDocument()
    expect(screen.getByText(/4\.4 kg to go/)).toBeInTheDocument()
    expect(screen.getByLabelText(/56% of the way to 70\.0 kg/)).toBeInTheDocument()
  })

  it('speaks the trend only once there is one', () => {
    const trend = { points: [], kgPerWeek: -0.42, projectedDate: new Date('2026-12-05T00:00:00Z') }
    render(<WeightHero weightLogs={LOGS} profile={PROFILE} trend={trend} />)
    expect(screen.getByText(/0\.42 kg a week/)).toBeInTheDocument()
    expect(screen.getByText(/around 5 Dec 2026/)).toBeInTheDocument()
  })

  it('with no weigh-ins, shows the profile weight and asks for one', () => {
    render(<WeightHero weightLogs={[]} profile={PROFILE} trend={NO_TREND} />)
    expect(screen.getByText('76.0')).toBeInTheDocument()
    expect(screen.queryByText(/kg lost/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /log a weigh-in/i })).toHaveAttribute('href', '/weight')
  })
})
