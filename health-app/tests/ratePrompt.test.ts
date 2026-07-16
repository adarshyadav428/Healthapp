import { describe, it, expect } from 'vitest'
import {
  parseRatePromptState,
  shouldShowRatePrompt,
  RATE_PROMPT_MIN_STREAK,
  RATE_PROMPT_COOLDOWN_DAYS,
} from '../lib/ratePrompt'

const NOW = new Date('2026-07-16T10:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

const base = { streakDays: RATE_PROMPT_MIN_STREAK, inPlayTwa: true, state: null, now: NOW }

describe('shouldShowRatePrompt', () => {
  it('shows with a qualifying streak inside the Play TWA and no prior state', () => {
    expect(shouldShowRatePrompt(base)).toBe(true)
  })

  it('hides below the minimum streak', () => {
    expect(shouldShowRatePrompt({ ...base, streakDays: RATE_PROMPT_MIN_STREAK - 1 })).toBe(false)
    expect(shouldShowRatePrompt({ ...base, streakDays: 0 })).toBe(false)
  })

  it('hides outside the Play TWA (web users cannot rate)', () => {
    expect(shouldShowRatePrompt({ ...base, inPlayTwa: false })).toBe(false)
  })

  it('never asks again after the user tapped through to the store', () => {
    expect(shouldShowRatePrompt({ ...base, state: { rated: true } })).toBe(false)
  })

  it('respects the dismissal cooldown', () => {
    expect(
      shouldShowRatePrompt({
        ...base,
        state: { lastDismissedAt: daysAgo(RATE_PROMPT_COOLDOWN_DAYS - 1) },
      })
    ).toBe(false)
    expect(
      shouldShowRatePrompt({
        ...base,
        state: { lastDismissedAt: daysAgo(RATE_PROMPT_COOLDOWN_DAYS + 1) },
      })
    ).toBe(true)
  })

  it('fails open on an unparseable dismissal timestamp', () => {
    expect(
      shouldShowRatePrompt({ ...base, state: { lastDismissedAt: 'not-a-date' } })
    ).toBe(true)
  })
})

describe('parseRatePromptState', () => {
  it('parses valid stored state', () => {
    expect(parseRatePromptState('{"rated":true}')).toEqual({ rated: true })
  })

  it('treats null, malformed JSON, and non-objects as no state', () => {
    expect(parseRatePromptState(null)).toBe(null)
    expect(parseRatePromptState('{oops')).toBe(null)
    expect(parseRatePromptState('"just a string"')).toBe(null)
    expect(parseRatePromptState('42')).toBe(null)
  })
})
