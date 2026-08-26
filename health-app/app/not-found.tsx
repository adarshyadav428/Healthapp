import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 text-hero-lg select-none">🍱</div>

      <h1 className="font-display text-hero font-bold text-ink mb-2">404</h1>
      <p className="text-title-sm font-bold text-ink mb-1">Page not found</p>
      <p className="text-body text-ink-2 mb-8 max-w-xs">
        Looks like this page went on a diet and disappeared. Let&rsquo;s get you back on track.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/dashboard"
          className="w-full rounded-control bg-brand py-3 text-body font-bold text-white text-center hover:opacity-90 active:scale-[.98] transition-all shadow-rest"
        >
          Go to Dashboard
        </Link>
        <Link
          href="/log"
          className="w-full rounded-control border border-hairline bg-surface py-3 text-body font-bold text-ink text-center hover:bg-surface-2 transition-all"
        >
          Log Food
        </Link>
      </div>
    </div>
  )
}
