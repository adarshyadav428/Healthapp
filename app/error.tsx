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
    // Log error to monitoring service in production
    console.error('Global error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#fff7ed] flex flex-col items-center justify-center px-6 text-center">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(239,68,68,0.1),_transparent_50%)]" />

      <div className="mb-6 text-7xl select-none">😵</div>

      <h1 className="text-2xl font-black text-gray-900 mb-2">Something went wrong</h1>
      <p className="text-sm text-gray-500 mb-2 max-w-xs">
        An unexpected error occurred. Your data is safe — please try again.
      </p>
      {error.digest && (
        <p className="text-[11px] text-gray-400 mb-6 font-mono">Error ID: {error.digest}</p>
      )}

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={reset}
          className="w-full rounded-2xl bg-orange-600 py-3 text-sm font-bold text-white hover:bg-orange-700 active:scale-[.98] transition-all shadow-sm"
        >
          Try again
        </button>
        <a
          href="/dashboard"
          className="w-full rounded-2xl border border-orange-200 bg-orange-50 py-3 text-sm font-bold text-orange-700 text-center hover:bg-orange-100 transition-all"
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  )
}
