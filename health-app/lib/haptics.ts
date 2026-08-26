/**
 * Haptic feedback — the decision, not the effect.
 *
 * A log that buzzes under the thumb reads as native; one that doesn't reads as
 * a website with a nice font. The app had no haptics at all, and inside the TWA
 * (Android Chrome) `navigator.vibrate` is available and free.
 *
 * Only three patterns exist, and they map to the three moments worth marking —
 * not to every tap. Haptics stop meaning anything the moment everything has one.
 *
 * Pure, per the lib/ contract: capabilities and preference are passed in, never
 * probed here. `shouldVibrate` is the whole policy; the caller does the buzzing.
 */

export const HAPTIC_PATTERNS = {
  /** A food was logged. One short tick — this fires many times a day. */
  tap: [8],
  /** The streak advanced. Two beats, so it is felt as different from a log. */
  success: [10, 40, 18],
  /** A milestone or badge. The only pattern allowed to be noticeable. */
  celebrate: [12, 30, 12, 30, 24],
} as const

export type HapticPattern = keyof typeof HAPTIC_PATTERNS

/**
 * Three-way, matching how the app already handles theme (Light/Dark/System):
 * an explicit choice wins, and 'system' defers to the OS signal.
 */
export type HapticPreference = 'on' | 'off' | 'system'

export const DEFAULT_HAPTIC_PREFERENCE: HapticPreference = 'system'

export type HapticContext = {
  /** navigator.vibrate exists — false on iOS Safari, which has no vibration API. */
  supported: boolean
  /** The `prefers-reduced-motion: reduce` media query matches. */
  reducedMotion: boolean
  preference: HapticPreference
}

/**
 * `prefers-reduced-motion` is about vestibular comfort, not haptics, so it is
 * the *default* here rather than an override: someone who has asked the OS to
 * calm things down gets no buzz unless they say otherwise, and someone who
 * explicitly turns haptics on still gets them. Treating it as an absolute veto
 * would silently ignore a preference the user set in this app.
 */
export function shouldVibrate(ctx: HapticContext): boolean {
  if (!ctx.supported) return false
  if (ctx.preference === 'off') return false
  if (ctx.preference === 'on') return true
  return !ctx.reducedMotion
}

/** Anything unrecognised (absent key, stale value, hand-edited storage) → the default. */
export function parseHapticPreference(raw: string | null | undefined): HapticPreference {
  return raw === 'on' || raw === 'off' || raw === 'system' ? raw : DEFAULT_HAPTIC_PREFERENCE
}
