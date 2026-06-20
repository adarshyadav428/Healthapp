import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center dark:bg-slate-950">
      <div className="mb-6 text-7xl select-none">🍱</div>

      <h1 className="text-5xl font-black text-foreground mb-2">404</h1>
      <p className="text-lg font-bold text-foreground mb-1">Page not found</p>
      <p className="text-sm text-muted mb-8 max-w-xs">
        Looks like this page went on a diet and disappeared. Let&rsquo;s get you back on track.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/dashboard"
          className="w-full rounded-2xl bg-orange-500 py-3 text-sm font-bold text-white text-center hover:bg-orange-600 active:scale-[.98] transition-all shadow-sm"
        >
          Go to Dashboard
        </Link>
        <Link
          href="/log"
          className="w-full rounded-2xl border border-border bg-card py-3 text-sm font-bold text-foreground text-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
        >
          Log Food
        </Link>
      </div>
    </div>
  )
}
