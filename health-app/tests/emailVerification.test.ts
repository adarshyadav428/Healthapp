import { describe, it, expect } from 'vitest'
import {
  shouldPromptEmailVerification,
  parseVerifyPromptState,
  VERIFY_PROMPT_GRACE_DAYS,
  VERIFY_PROMPT_COOLDOWN_DAYS,
} from '../lib/emailVerification'

const NOW = new Date('2026-08-01T12:00:00.000Z')

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86_400_000).toISOString()
}

function args(over: Partial<Parameters<typeof shouldPromptEmailVerification>[0]> = {}) {
  return {
    emailVerifiedAt: null,
    accountCreatedAt: daysAgo(VERIFY_PROMPT_GRACE_DAYS + 1),
    state: null,
    now: NOW,
    ...over,
  }
}

describe('shouldPromptEmailVerification', () => {
  it('prompts an unverified account past the grace period', () => {
    expect(shouldPromptEmailVerification(args())).toBe(true)
  })

  it('never prompts a verified account', () => {
    expect(shouldPromptEmailVerification(args({ emailVerifiedAt: daysAgo(1) }))).toBe(false)
  })

  it('stays quiet during the grace period so new users can explore', () => {
    expect(shouldPromptEmailVerification(args({ accountCreatedAt: daysAgo(1) }))).toBe(false)
  })

  // The grace boundary is inclusive: once the full window has elapsed the user
  // has had their time to explore, so the ask is due.
  it('prompts exactly at the grace boundary', () => {
    const at = args({ accountCreatedAt: daysAgo(VERIFY_PROMPT_GRACE_DAYS) })
    expect(shouldPromptEmailVerification(at)).toBe(true)
  })

  it('stays quiet just under the grace boundary', () => {
    const at = args({ accountCreatedAt: daysAgo(VERIFY_PROMPT_GRACE_DAYS - 0.01) })
    expect(shouldPromptEmailVerification(at)).toBe(false)
  })

  it('respects the cooldown after a dismissal', () => {
    const state = { lastDismissedAt: daysAgo(VERIFY_PROMPT_COOLDOWN_DAYS - 1) }
    expect(shouldPromptEmailVerification(args({ state }))).toBe(false)
  })

  it('prompts again once the cooldown has elapsed', () => {
    const state = { lastDismissedAt: daysAgo(VERIFY_PROMPT_COOLDOWN_DAYS + 1) }
    expect(shouldPromptEmailVerification(args({ state }))).toBe(true)
  })

  it('a verified account beats an elapsed cooldown', () => {
    const state = { lastDismissedAt: daysAgo(365) }
    expect(shouldPromptEmailVerification(args({ emailVerifiedAt: daysAgo(1), state }))).toBe(false)
  })

  it('stays quiet when the account creation date is missing', () => {
    expect(shouldPromptEmailVerification(args({ accountCreatedAt: null }))).toBe(false)
  })

  it('stays quiet when the account creation date is unparseable', () => {
    expect(shouldPromptEmailVerification(args({ accountCreatedAt: 'nonsense' }))).toBe(false)
  })

  it('ignores an unparseable dismissal timestamp rather than hiding forever', () => {
    expect(shouldPromptEmailVerification(args({ state: { lastDismissedAt: 'nope' } }))).toBe(true)
  })

  describe('an AI gate block overrides the grace period', () => {
    it('prompts a day-1 account once an AI scan was refused for it', () => {
      const at = args({
        accountCreatedAt: daysAgo(1),
        state: { aiGateBlockedAt: daysAgo(0) },
      })
      expect(shouldPromptEmailVerification(at)).toBe(true)
    })

    it('still never prompts a verified account, AI block or not', () => {
      const at = args({
        emailVerifiedAt: daysAgo(1),
        accountCreatedAt: daysAgo(1),
        state: { aiGateBlockedAt: daysAgo(0) },
      })
      expect(shouldPromptEmailVerification(at)).toBe(false)
    })

    it('a block newer than the last dismissal re-opens the ask inside the cooldown', () => {
      const at = args({
        state: { lastDismissedAt: daysAgo(2), aiGateBlockedAt: daysAgo(1) },
      })
      expect(shouldPromptEmailVerification(at)).toBe(true)
    })

    it('an older block does not defeat a fresh dismissal', () => {
      const at = args({
        state: { lastDismissedAt: daysAgo(1), aiGateBlockedAt: daysAgo(2) },
      })
      expect(shouldPromptEmailVerification(at)).toBe(false)
    })

    it('an unparseable block timestamp is simply ignored', () => {
      const at = args({
        accountCreatedAt: daysAgo(1),
        state: { aiGateBlockedAt: 'nope' },
      })
      expect(shouldPromptEmailVerification(at)).toBe(false)
    })
  })
})

describe('parseVerifyPromptState', () => {
  it('returns null for missing storage', () => {
    expect(parseVerifyPromptState(null)).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    expect(parseVerifyPromptState('{oh no')).toBeNull()
  })

  it('returns null for valid JSON that is not an object', () => {
    expect(parseVerifyPromptState('"a string"')).toBeNull()
  })

  it('round-trips a stored dismissal', () => {
    const iso = daysAgo(2)
    expect(parseVerifyPromptState(JSON.stringify({ lastDismissedAt: iso }))).toEqual({
      lastDismissedAt: iso,
    })
  })
})
