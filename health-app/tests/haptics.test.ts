import { describe, it, expect } from 'vitest'
import {
  shouldVibrate,
  parseHapticPreference,
  HAPTIC_PATTERNS,
  DEFAULT_HAPTIC_PREFERENCE,
  type HapticPreference,
} from '../lib/haptics'

const ctx = (over: Partial<Parameters<typeof shouldVibrate>[0]> = {}) => ({
  supported: true,
  reducedMotion: false,
  preference: 'system' as HapticPreference,
  ...over,
})

describe('shouldVibrate', () => {
  it('never vibrates where the API does not exist', () => {
    // iOS Safari has no vibration API at all. An explicit "on" cannot conjure one.
    for (const preference of ['on', 'off', 'system'] as const) {
      expect(shouldVibrate(ctx({ supported: false, preference }))).toBe(false)
    }
  })

  it('honours an explicit off even when everything else says yes', () => {
    expect(shouldVibrate(ctx({ preference: 'off', reducedMotion: false }))).toBe(false)
  })

  it('honours an explicit on even under reduced motion', () => {
    // reduced-motion is about vestibular comfort, not haptics. Someone who
    // turned haptics on in this app has answered the more specific question,
    // and silently ignoring that would be the bug.
    expect(shouldVibrate(ctx({ preference: 'on', reducedMotion: true }))).toBe(true)
  })

  it('follows reduced motion when the preference is system', () => {
    expect(shouldVibrate(ctx({ preference: 'system', reducedMotion: true }))).toBe(false)
    expect(shouldVibrate(ctx({ preference: 'system', reducedMotion: false }))).toBe(true)
  })

  it('defaults to buzzing on a capable device with no stated preference', () => {
    expect(shouldVibrate(ctx({ preference: DEFAULT_HAPTIC_PREFERENCE }))).toBe(true)
  })
})

describe('parseHapticPreference', () => {
  it('round-trips every valid value', () => {
    for (const v of ['on', 'off', 'system'] as const) {
      expect(parseHapticPreference(v)).toBe(v)
    }
  })

  it('falls back to the default for anything unrecognised', () => {
    for (const bad of [null, undefined, '', 'yes', 'true', 'ON', '{}']) {
      expect(parseHapticPreference(bad)).toBe(DEFAULT_HAPTIC_PREFERENCE)
    }
  })
})

describe('HAPTIC_PATTERNS', () => {
  it('stays at three patterns — haptics mean nothing if everything has one', () => {
    expect(Object.keys(HAPTIC_PATTERNS)).toEqual(['tap', 'success', 'celebrate'])
  })

  it('keeps the per-log tick shortest, since it fires many times a day', () => {
    const total = (p: readonly number[]) => p.reduce((a, b) => a + b, 0)
    expect(total(HAPTIC_PATTERNS.tap)).toBeLessThan(total(HAPTIC_PATTERNS.success))
    expect(total(HAPTIC_PATTERNS.success)).toBeLessThan(total(HAPTIC_PATTERNS.celebrate))
  })

  it('uses buzz durations short enough to read as a tick, not a ring', () => {
    for (const pattern of Object.values(HAPTIC_PATTERNS)) {
      // even-indexed entries are vibration durations; odd are the gaps between
      pattern.forEach((ms, i) => {
        if (i % 2 === 0) expect(ms).toBeLessThanOrEqual(25)
      })
    }
  })
})
