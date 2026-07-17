'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

// Client-side error capture, initialised at runtime (no webpack plugin). Inert
// until NEXT_PUBLIC_SENTRY_DSN is set, production-only, errors only.
export function SentryInit() {
  useEffect(() => {
    const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
    if (dsn && process.env.NODE_ENV === 'production' && !Sentry.getClient()) {
      Sentry.init({ dsn, tracesSampleRate: 0 })
    }
  }, [])
  return null
}
