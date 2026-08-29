/**
 * Which shell the app is running in, for tagging analytics events.
 *
 * `lib/play/billing.ts` has the authoritative TWA check, but it is async (it
 * probes for the Digital Goods API). This is the synchronous, render-safe
 * approximation — good enough to split the trial-bearing Play funnel from the
 * no-trial web funnel on every event via a PostHog super-property.
 *
 *   twa — installed Android app (Trusted Web Activity). Referrer is android-app://
 *   pwa — installed PWA / added to home screen (standalone display mode)
 *   web — a normal browser tab
 */
export type Platform = 'twa' | 'pwa' | 'web'

export function detectPlatform(
  win: Window | undefined = typeof window !== 'undefined' ? window : undefined,
): Platform {
  if (!win) return 'web'
  if (win.document?.referrer?.startsWith('android-app://')) return 'twa'
  const standalone =
    win.matchMedia?.('(display-mode: standalone)').matches === true ||
    (win.navigator as Navigator & { standalone?: boolean }).standalone === true
  return standalone ? 'pwa' : 'web'
}
