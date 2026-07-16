import { describe, it, expect } from 'vitest'
import { shouldShowA2hs, parseA2hsState, A2HS_COOLDOWN_DAYS } from '../lib/a2hs'

const NOW = new Date('2026-07-16T10:00:00Z')
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

const base = { canPrompt: true, isStandalone: false, state: null, now: NOW }

describe('shouldShowA2hs', () => {
  it('shows when the browser can prompt and nothing blocks it', () => {
    expect(shouldShowA2hs(base)).toBe(true)
  })

  it('hides without a captured beforeinstallprompt (iOS, already installed, unsupported)', () => {
    expect(shouldShowA2hs({ ...base, canPrompt: false })).toBe(false)
  })

  it('hides when already running standalone (installed PWA or Play TWA)', () => {
    expect(shouldShowA2hs({ ...base, isStandalone: true })).toBe(false)
  })

  it('never asks again after an accepted install', () => {
    expect(shouldShowA2hs({ ...base, state: { installed: true } })).toBe(false)
  })

  it('respects the dismissal cooldown', () => {
    expect(
      shouldShowA2hs({ ...base, state: { lastDismissedAt: daysAgo(A2HS_COOLDOWN_DAYS - 1) } })
    ).toBe(false)
    expect(
      shouldShowA2hs({ ...base, state: { lastDismissedAt: daysAgo(A2HS_COOLDOWN_DAYS + 1) } })
    ).toBe(true)
  })

  it('fails open on an unparseable dismissal timestamp', () => {
    expect(shouldShowA2hs({ ...base, state: { lastDismissedAt: 'garbage' } })).toBe(true)
  })
})

describe('parseA2hsState', () => {
  it('parses valid state and rejects malformed input', () => {
    expect(parseA2hsState('{"installed":true}')).toEqual({ installed: true })
    expect(parseA2hsState(null)).toBe(null)
    expect(parseA2hsState('{oops')).toBe(null)
    expect(parseA2hsState('7')).toBe(null)
  })
})
