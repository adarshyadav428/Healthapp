import { PostHog } from 'posthog-node'

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
  event: string,
  properties?: Record<string, unknown>
): void {
  const ph = getClient()
  if (!ph) return
  ph.capture({ distinctId, event, properties })
}
