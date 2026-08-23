import { PostHog } from 'posthog-node'
import { isFoodLogMethod, type AnalyticsEvent, type FoodLogMethod } from './events'
import type { StreakEvent } from '../streakEvents'

let client: PostHog | null = null

function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return null
  if (!client) {
    client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1, // serverless: flush immediately, don't rely on a background timer
      flushInterval: 0,
    })
  }
  return client
}

/**
 * Fire-and-forget server-side event capture. No-ops silently if PostHog
 * isn't configured (no NEXT_PUBLIC_POSTHOG_KEY) so local dev never breaks.
 */
export function captureServerEvent(
  distinctId: string,
  event: AnalyticsEvent,
  properties?: Record<string, unknown>
): void {
  const ph = getClient()
  if (!ph) return
  ph.capture({ distinctId, event, properties })
}

/**
 * Read the browser-only `food_logged` props the client attaches as headers
 * (see logMetaHeaders in ./client). Both are untrusted input, so the method
 * is validated against the known set and the seconds must parse to a finite
 * non-negative number — anything else degrades to the route's own default.
 */
export function readLogMeta(
  req: Request,
  fallbackMethod: FoodLogMethod
): { method: FoodLogMethod; seconds_since_open: number | null; seconds_to_log: number | null } {
  const rawMethod = req.headers.get('x-log-method')

  // Same untrusted-input treatment for both timings.
  const readSeconds = (header: string): number | null => {
    const raw = req.headers.get(header)
    const n = raw === null || raw === '' ? NaN : Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : null
  }

  return {
    method: isFoodLogMethod(rawMethod) ? rawMethod : fallbackMethod,
    seconds_since_open: readSeconds('x-seconds-since-open'),
    // Time from opening a logging surface to the log landing. Distinct from
    // seconds_since_open, which is measured from app load and never resets —
    // see markLogStart in ./client for why that can't answer this question.
    seconds_to_log: readSeconds('x-seconds-to-log'),
  }
}

/**
 * The one place `food_logged` is emitted. Every log route funnels through
 * here so the event's shape can't drift between the add / quick-add /
 * copy-yesterday / bulk paths, and so `first_food_logged` is guaranteed to
 * fire exactly once — on the log that flipped the user from zero.
 */
export function captureFoodLogged(
  userId: string,
  req: Request,
  fallbackMethod: FoodLogMethod,
  data: {
    meal: string
    isFirstLog: boolean
    daysSinceSignup: number | null
    kcal?: number
    items?: number
    /**
     * Streak-lifecycle events this log produced, from streakEventsForLog.
     * Routed through here so all five log routes emit them identically and the
     * shape can't drift, exactly as `food_logged` itself is funnelled.
     */
    streakEvents?: StreakEvent[]
  }
): void {
  const { method, seconds_since_open, seconds_to_log } = readLogMeta(req, fallbackMethod)
  const base = { method, meal: data.meal, seconds_since_open, seconds_to_log }

  captureServerEvent(userId, 'food_logged', {
    ...base,
    ...(data.kcal === undefined ? {} : { kcal: data.kcal }),
    ...(data.items === undefined ? {} : { items: data.items }),
    is_first_log: data.isFirstLog,
    days_since_signup: data.daysSinceSignup,
  })

  if (data.isFirstLog) captureServerEvent(userId, 'first_food_logged', base)

  for (const event of data.streakEvents ?? []) {
    captureServerEvent(userId, event.name, { ...event.props, method })
  }
}
