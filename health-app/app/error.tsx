'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Global error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 text-7xl select-none">😵</div>

      <h1 className="font-display text-2xl font-bold text-ink mb-2">Something went wrong</h1>
      <p className="text-sm text-ink-2 mb-2 max-w-xs">
        An unexpected error occurred. Your data is safe — please try again.
      </p>
      {error.digest && (
        <p className="text-[11px] text-ink-2 mb-6 font-mono">Error ID: {error.digest}</p>
      )}

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={reset}
          className="w-full rounded-control bg-brand py-3 text-sm font-bold text-white hover:opacity-90 active:scale-[.98] transition-all shadow-rest"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="w-full rounded-control border border-hairline bg-surface py-3 text-sm font-bold text-ink text-center hover:bg-surface-2 transition-all"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  )
}
