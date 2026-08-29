'use client'

import posthog from 'posthog-js'
import { EVENTS, type AnalyticsEvent, type FoodLogMethod } from './events'
import { detectPlatform } from '../platform'

let initialized = false

/**
 * The experiment arm this device is in. Always 'control' today — Tier 5 of the
 * growth-advice audit (the `gis_bkt` bucketing mechanism) would make this
 * dynamic. Registered as a super-property now so every event already carries a
 * `variant` key and funnels authored today don't need rebuilding later.
 */
function readVariant(): string {
  return 'control'
}

/**
 * User-facing analytics opt-out (Settings → Privacy). We keep our own flag
 * rather than relying solely on posthog-js's internal opt-out state so the
 * toggle can render the right position before PostHog has initialised (and
 * still works when no key is configured at all, e.g. local dev).
 */
const OPT_OUT_KEY = 'gis_analytics_opt_out'

export function isAnalyticsOptedOut(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(OPT_OUT_KEY) === '1'
  } catch {
    return false
  }
}

function ensureInit(): typeof posthog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return null
  if (!initialized) {
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: false, // we send $pageview manually on route change (App Router)
    })
    initialized = true
    // Device-level super-properties — ride on every event automatically so the
    // trial-bearing Play funnel and the no-trial web funnel are separable, and
    // so every event is splittable by experiment arm.
    posthog.register({ platform: detectPlatform(), variant: readVariant() })
    // Re-apply a stored opt-out on every fresh load, before anything captures.
    if (isAnalyticsOptedOut()) posthog.opt_out_capturing()
  }
  return posthog
}

/**
 * Register the signed-in-state super-properties so `is_authenticated` / `is_pro`
 * ride on every event, giving the audit's funnels a typed denominator. Called
 * from Providers once the session and subscription have resolved.
 */
export function registerIdentitySuperProps(props: {
  isAuthenticated: boolean
  isPro: boolean
}): void {
  ensureInit()?.register({
    is_authenticated: props.isAuthenticated,
    is_pro: props.isPro,
  })
}

/** Turn capture on/off and remember the choice across sessions. */
export function setAnalyticsOptOut(optOut: boolean): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(OPT_OUT_KEY, optOut ? '1' : '0')
    } catch {
      /* storage unavailable — the in-memory posthog call below still applies */
    }
  }
  const ph = ensureInit()
  if (!ph) return
  if (optOut) ph.opt_out_capturing()
  else ph.opt_in_capturing()
}

export function identifyUser(
  userId: string,
  properties?: Record<string, unknown>,
  setOnceProperties?: Record<string, unknown>,
): void {
  ensureInit()?.identify(userId, properties, setOnceProperties)
}

export function resetIdentity(): void {
  ensureInit()?.reset()
}

export function captureEvent(event: AnalyticsEvent, properties?: Record<string, unknown>): void {
  ensureInit()?.capture(event, properties)
}

export function capturePageview(url: string): void {
  ensureInit()?.capture('$pageview', { $current_url: url })
}

/* ------------------------------------------------------------------ *
 * Session timing — powers `seconds_since_open`, the metric behind the
 * spec's "first log under 60s" and "repeat log under 10s" targets.
 * ------------------------------------------------------------------ */

let appOpenedAt: number | null = null

/**
 * Fire once per app load (from Providers). Safe to call repeatedly — the first
 * call wins, so pass the auth/Pro context once it has resolved.
 *
 * `app_opened` used to fire with no properties, which left it with no typed
 * denominator (the audit's §8 #5). It now carries platform (via the
 * super-property), whether the visitor is signed in / Pro, and the PostHog
 * session id.
 */
export function markAppOpened(ctx?: { isAuthenticated?: boolean; isPro?: boolean }): void {
  if (appOpenedAt !== null) return
  appOpenedAt = Date.now()
  const ph = ensureInit()
  captureEvent(EVENTS.APP_OPENED, {
    is_authenticated: ctx?.isAuthenticated ?? false,
    is_pro: ctx?.isPro ?? false,
    session_id: ph?.get_session_id?.() ?? null,
  })
}

/** Seconds since this app load, or null if the open wasn't recorded. */
export function secondsSinceOpen(): number | null {
  if (appOpenedAt === null) return null
  return Math.round((Date.now() - appOpenedAt) / 1000)
}

let logStartedAt: number | null = null

/**
 * Stamp the moment a logging surface opened — search, camera, chat, quick add,
 * or the tap on a one-tap shortcut.
 *
 * Unlike `markAppOpened` this deliberately RESETS on every call. That is the
 * whole point: `seconds_since_open` is measured from a single app load and
 * never resets, so the 2nd, 5th and 20th log of a session each report a larger
 * number than the last regardless of how fast they were. It cannot answer "how
 * long does a log take", which is the metric that actually predicts whether
 * someone is still tracking in a month.
 */
export function markLogStart(): void {
  logStartedAt = Date.now()
}

/** Seconds since the current logging surface opened, or null if none did. */
export function secondsSinceLogStart(): number | null {
  if (logStartedAt === null) return null
  return Math.round((Date.now() - logStartedAt) / 1000)
}

/* ------------------------------------------------------------------ *
 * Log metadata headers.
 *
 * `food_logged` is fired server-side (it's the core metric of the habit
 * loop, and server events survive ad-blockers). But two of its props are
 * things only the browser knows: how the user initiated the log, and how
 * long they'd been in the app. We send those as request headers so no
 * route's request schema has to grow analytics fields — and so it works
 * for bodyless posts like copy-yesterday.
 * ------------------------------------------------------------------ */

export function logMetaHeaders(method: FoodLogMethod): Record<string, string> {
  const seconds = secondsSinceOpen()
  const toLog = secondsSinceLogStart()
  return {
    'x-log-method': method,
    ...(seconds === null ? {} : { 'x-seconds-since-open': String(seconds) }),
    ...(toLog === null ? {} : { 'x-seconds-to-log': String(toLog) }),
  }
}
