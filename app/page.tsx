import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fff7ed] overflow-x-hidden">
      {/* Gradient blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.3),_transparent_50%),radial-gradient(circle_at_bottom_left,_rgba(248,113,113,0.2),_transparent_50%)]" />

      {/* Header */}
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🥗</span>
          <span className="text-xl font-black text-gray-900 tracking-tight">CalTrack</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/sign-in" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Sign in
          </Link>
          <Link
            href="/auth/sign-up"
            className="rounded-full bg-orange-600 px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 transition-colors shadow-md"
          >
            Start free
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto w-full max-w-4xl px-5 pb-24">
        <section className="py-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700 mb-6">
            🇮🇳 India&apos;s food database included
          </div>
          <h1 className="text-4xl font-black leading-tight text-gray-900 sm:text-5xl">
            Track calories the<br />
            <span className="text-orange-600">Indian way</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base text-gray-600">
            Dal, roti, biryani, dosa — 300+ desi dishes with accurate nutrition.
            Plus exercise tracking, water intake, and weight trends.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/auth/sign-up"
              className="rounded-full bg-orange-600 px-8 py-3 text-base font-bold text-white hover:bg-orange-700 transition-colors shadow-lg"
            >
              Start for free →
            </Link>
            <Link
              href="/auth/sign-in"
              className="rounded-full border border-orange-200 bg-white px-8 py-3 text-base font-semibold text-gray-700 hover:bg-orange-50 transition-colors"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-3 text-xs text-gray-400">Free forever · No credit card</p>
        </section>

        {/* App preview mockup */}
        <section className="mx-auto max-w-sm">
          <div className="rounded-3xl border border-orange-100 bg-white/80 p-5 shadow-xl backdrop-blur-sm space-y-3">
            {/* Calorie ring mock */}
            <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-600 font-semibold uppercase tracking-wide">Net calories</p>
                <p className="text-3xl font-black text-gray-900">1,420</p>
                <p className="text-sm text-gray-500">of 1,800 goal</p>
                <p className="text-sm font-bold text-emerald-600 mt-1">380 kcal remaining</p>
              </div>
              <div className="relative h-24 w-24 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#fde68a" strokeWidth="14" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#16a34a" strokeWidth="14"
                    strokeDasharray="239" strokeDashoffset="62" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-bold text-emerald-700">380</span>
                  <span className="text-[9px] text-gray-400">left</span>
                </div>
              </div>
            </div>

            {/* Macro cards mock */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Protein', val: '95g', target: '/120g', bg: 'bg-blue-50', bar: 'bg-blue-500', pct: '79%' },
                { label: 'Carbs', val: '180g', target: '/200g', bg: 'bg-amber-50', bar: 'bg-amber-400', pct: '90%' },
                { label: 'Fat', val: '42g', target: '/55g', bg: 'bg-rose-50', bar: 'bg-rose-400', pct: '76%' },
              ].map((m) => (
                <div key={m.label} className={`rounded-xl ${m.bg} p-2`}>
                  <p className="text-[10px] font-semibold text-gray-600 uppercase">{m.label}</p>
                  <p className="text-sm font-black text-gray-900">{m.val}</p>
                  <p className="text-[10px] text-gray-400">{m.target}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-white/60 overflow-hidden">
                    <div className={`h-full ${m.bar} rounded-full`} style={{ width: m.pct }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Recent meals mock */}
            <div className="rounded-2xl bg-gray-50 p-3 space-y-2">
              <p className="text-xs font-bold text-gray-500 flex items-center gap-1">🥣 Breakfast <span className="ml-auto bg-orange-50 border border-orange-100 rounded-full px-2 py-0.5 text-orange-600">486 kcal</span></p>
              {[
                { name: 'Poha with peanuts', kcal: 286 },
                { name: 'Chai with milk', kcal: 60 },
                { name: 'Boiled egg', kcal: 140 },
              ].map((f) => (
                <div key={f.name} className="flex justify-between text-xs bg-white rounded-lg px-3 py-2">
                  <span className="text-gray-800 font-medium">{f.name}</span>
                  <span className="text-gray-500">{f.kcal} kcal</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mt-16 grid gap-4 sm:grid-cols-2">
          {[
            { emoji: '🍛', title: '300+ Indian foods', desc: 'Dal makhani, biryani, idli, paratha — all with authentic IFCT 2017 nutrition data. Searched in Hindi and English.' },
            { emoji: '⚡', title: 'Log in 5 seconds', desc: 'Recent foods + quick-add button. Copy yesterday\'s meals with one tap. Never type the same food twice.' },
            { emoji: '🏋️', title: 'Exercise tracking', desc: 'Log workouts, walks, yoga. Burned calories offset your daily goal automatically.' },
            { emoji: '💧', title: 'Water tracker', desc: 'Track glasses and bottles throughout the day with one-tap quick add. Never forget to hydrate.' },
            { emoji: '📈', title: 'Weight trends', desc: 'Visualize your progress with a 14-day trend chart. See real movement, not just a number.' },
            { emoji: '🔥', title: 'Daily streaks', desc: 'Build the logging habit with streak badges. 7 days, 30 days — watch the flames grow.' },
          ].map((f) => (
            <div key={f.title} className="rounded-3xl border border-orange-100 bg-white/80 p-5 shadow-sm">
              <span className="text-2xl">{f.emoji}</span>
              <h3 className="mt-2 text-base font-bold text-gray-900">{f.title}</h3>
              <p className="mt-1 text-sm text-gray-600">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* Pricing teaser */}
        <section className="mt-16 rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-8 text-center shadow-sm">
          <h2 className="text-2xl font-black text-gray-900">Free for the basics. Pro for everything.</h2>
          <p className="mt-2 text-sm text-gray-600">Free tier: 5 food logs per day. Pro: unlimited everything.</p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/auth/sign-up"
              className="rounded-full bg-orange-600 px-8 py-3 text-sm font-bold text-white hover:bg-orange-700 transition-colors shadow-md"
            >
              Start free
            </Link>
            <Link
              href="/upgrade"
              className="rounded-full border border-orange-200 bg-white px-8 py-3 text-sm font-semibold text-orange-700 hover:bg-orange-50 transition-colors"
            >
              See Pro plans →
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-orange-100 bg-white/60 px-5 py-8 text-center text-xs text-gray-400">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <span>© 2026 CalTrack · hello@caltrack.app</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-gray-600">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-600">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
