import { PostHog } from 'posthog-node'
import { isFoodLogMethod, type AnalyticsEvent, type FoodLogMethod } from './events'

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
): { method: FoodLogMethod; seconds_since_open: number | null } {
  const rawMethod = req.headers.get('x-log-method')
  const rawSeconds = req.headers.get('x-seconds-since-open')
  const seconds = rawSeconds === null || rawSeconds === '' ? NaN : Number(rawSeconds)

  return {
    method: isFoodLogMethod(rawMethod) ? rawMethod : fallbackMethod,
    seconds_since_open: Number.isFinite(seconds) && seconds >= 0 ? seconds : null,
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
  }
): void {
  const { method, seconds_since_open } = readLogMeta(req, fallbackMethod)
  const base = { method, meal: data.meal, seconds_since_open }

  captureServerEvent(userId, 'food_logged', {
    ...base,
    ...(data.kcal === undefined ? {} : { kcal: data.kcal }),
    ...(data.items === undefined ? {} : { items: data.items }),
    is_first_log: data.isFirstLog,
    days_since_signup: data.daysSinceSignup,
  })

  if (data.isFirstLog) captureServerEvent(userId, 'first_food_logged', base)
}
