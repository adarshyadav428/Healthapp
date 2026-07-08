'use client'

import posthog from 'posthog-js'

let initialized = false

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
  }
  return posthog
}

export function identifyUser(userId: string, properties?: Record<string, unknown>): void {
  ensureInit()?.identify(userId, properties)
}

export function resetIdentity(): void {
  ensureInit()?.reset()
}

export function captureEvent(event: string, properties?: Record<string, unknown>): void {
  ensureInit()?.capture(event, properties)
}

export function capturePageview(url: string): void {
  ensureInit()?.capture('$pageview', { $current_url: url })
}
