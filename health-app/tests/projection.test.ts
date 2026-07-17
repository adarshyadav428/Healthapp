import { describe, it, expect } from 'vitest'
import { weeksToGoal, projectGoalDate, formatGoalDate } from '../lib/projection'

describe('weeksToGoal', () => {
  it('divides the gap by the weekly pace', () => {
    expect(weeksToGoal(85, 75, 0.5)).toBe(20)   // 10 kg / 0.5
    expect(weeksToGoal(60, 65, 0.5)).toBe(10)   // gain: 5 kg / 0.5
  })
  it('returns null for zero pace or no gap', () => {
    expect(weeksToGoal(85, 75, 0)).toBeNull()
    expect(weeksToGoal(75, 75, 0.5)).toBeNull()
  })
})

describe('projectGoalDate', () => {
  it('lands the goal date the right number of days out', () => {
    const from = new Date('2026-07-17T00:00:00Z')
    const proj = projectGoalDate(85, 75, 0.5, from)! // 20 weeks = 140 days
    expect(proj.weeks).toBe(20)
    expect(proj.date.toISOString().slice(0, 10)).toBe('2026-12-04')
  })
  it('is null when no projection applies', () => {
    expect(projectGoalDate(75, 75, 0.5)).toBeNull()
  })
})

describe('formatGoalDate', () => {
  it('formats a friendly date', () => {
    expect(formatGoalDate(new Date('2026-12-04T00:00:00Z'))).toMatch(/Dec 2026/)
  })
})
