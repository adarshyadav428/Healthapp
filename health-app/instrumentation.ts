import * as Sentry from '@sentry/nextjs'

// Next 14.2 runs this on server/edge startup. We intentionally do NOT use
// withSentryConfig (the webpack plugin) — this is runtime error capture only,
// so the build pipeline is untouched and there's nothing to break if the DSN
// or an auth token is missing.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.server.config')
  }
}

// Captures errors thrown in Server Components, route handlers and middleware.
export const onRequestError = Sentry.captureRequestError
