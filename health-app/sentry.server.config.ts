import * as Sentry from '@sentry/nextjs'

// Errors-only monitoring. Inert until a DSN is set (Adarsh creates the Sentry
// project and adds SENTRY_DSN in Vercel), and only in production so dev stays
// quiet. No performance tracing (tracesSampleRate: 0) to keep it cheap.
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    enabled: process.env.NODE_ENV === 'production',
    tracesSampleRate: 0,
  })
}
