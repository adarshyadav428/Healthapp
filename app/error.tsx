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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center dark:bg-slate-950">
      <div className="mb-6 text-7xl select-none">😵</div>

      <h1 className="text-2xl font-black text-foreground mb-2">Something went wrong</h1>
      <p className="text-sm text-muted mb-2 max-w-xs">
        An unexpected error occurred. Your data is safe — please try again.
      </p>
      {error.digest && (
        <p className="text-[11px] text-muted mb-6 font-mono">Error ID: {error.digest}</p>
      )}

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={reset}
          className="w-full rounded-2xl bg-orange-500 py-3 text-sm font-bold text-white hover:bg-orange-600 active:scale-[.98] transition-all shadow-sm"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="w-full rounded-2xl border border-border bg-card py-3 text-sm font-bold text-foreground text-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  )
}
