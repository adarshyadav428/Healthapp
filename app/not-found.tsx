import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#fff7ed] flex flex-col items-center justify-center px-6 text-center">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.2),_transparent_50%)]" />

      <div className="mb-6 text-7xl select-none">🍱</div>

      <h1 className="text-5xl font-black text-gray-900 mb-2">404</h1>
      <p className="text-lg font-bold text-gray-700 mb-1">Page not found</p>
      <p className="text-sm text-gray-400 mb-8 max-w-xs">
        Looks like this page went on a diet and disappeared. Let&rsquo;s get you back on track.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/dashboard"
          className="w-full rounded-2xl bg-orange-600 py-3 text-sm font-bold text-white text-center hover:bg-orange-700 active:scale-[.98] transition-all shadow-sm"
        >
          Go to Dashboard
        </Link>
        <Link
          href="/log"
          className="w-full rounded-2xl border border-orange-200 bg-orange-50 py-3 text-sm font-bold text-orange-700 text-center hover:bg-orange-100 transition-all"
        >
          Log Food
        </Link>
      </div>
    </div>
  )
}
