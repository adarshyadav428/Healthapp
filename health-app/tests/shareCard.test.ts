import { describe, it, expect } from 'vitest'
import { buildShareCardData } from '../lib/shareCard'

describe('buildShareCardData', () => {
  it('makes the streak the hero and shows weight loss as the subline', () => {
    expect(
      buildShareCardData({ streakDays: 12, startWeightKg: 82, currentWeightKg: 78.8 })
    ).toEqual({
      hero: { value: '12', label: 'day streak' },
      subline: '3.2 kg down since starting',
    })
  })

  it('streak hero with no weight data has no subline', () => {
    expect(
      buildShareCardData({ streakDays: 5, startWeightKg: null, currentWeightKg: null })
    ).toEqual({ hero: { value: '5', label: 'day streak' }, subline: null })
  })

  it('ignores weight gain (never brags about the wrong direction)', () => {
    expect(
      buildShareCardData({ streakDays: 5, startWeightKg: 70, currentWeightKg: 71.5 })
    ).toEqual({ hero: { value: '5', label: 'day streak' }, subline: null })
  })

  it('ignores sub-0.1kg noise', () => {
    expect(
      buildShareCardData({ streakDays: 5, startWeightKg: 70.05, currentWeightKg: 70 })
    ).toEqual({ hero: { value: '5', label: 'day streak' }, subline: null })
  })

  it('falls back to weight loss as the hero when there is no streak', () => {
    expect(
      buildShareCardData({ streakDays: 0, startWeightKg: 82, currentWeightKg: 79 })
    ).toEqual({ hero: { value: '3.0 kg', label: 'down since starting' }, subline: null })
  })

  it('returns null when there is nothing to share yet', () => {
    expect(
      buildShareCardData({ streakDays: 0, startWeightKg: null, currentWeightKg: null })
    ).toBe(null)
    expect(
      buildShareCardData({ streakDays: 0, startWeightKg: 70, currentWeightKg: 70 })
    ).toBe(null)
  })
})
