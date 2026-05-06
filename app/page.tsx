import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fff7ed] overflow-x-hidden dark:bg-slate-950">
      {/* Gradient blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_rgba(251,191,36,0.3),_transparent_50%),radial-gradient(circle_at_bottom_left,_rgba(248,113,113,0.2),_transparent_50%)]" />

      {/* Header */}
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🥗</span>
          <span className="text-xl font-black text-foreground tracking-tight">CalTrack</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/sign-in" className="text-sm font-medium text-muted hover:text-foreground">
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

      <main className="mx-auto w-full max-w-4xl px-5 pb-24">
        {/* Hero */}
        <section className="py-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700 mb-6 dark:border-slate-700 dark:bg-slate-900 dark:text-amber-300">
            🇮🇳 Built for Indian diets &middot; 600+ desi foods included
          </div>
          <h1 className="text-4xl font-black leading-tight text-foreground sm:text-5xl">
            Track calories the<br />
            <span className="text-orange-600">Indian way</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base text-muted">
            Dal, roti, biryani, dosa — with accurate IFCT 2017 nutrition data.
            Log food in 5 seconds. See your macros, weight trend and calorie deficit — all in one place.
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
              className="rounded-full border border-orange-200 bg-white px-8 py-3 text-base font-semibold text-gray-700 hover:bg-orange-50 transition-colors dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted">Free forever · No credit card · Works offline</p>
        </section>

        {/* App preview mockup */}
        <section className="mx-auto max-w-sm">
          <div className="rounded-3xl border border-orange-100 bg-white/80 p-5 shadow-xl backdrop-blur-sm space-y-3 dark:border-slate-800 dark:bg-slate-900/80">
            {/* Calorie ring mock */}
            <div className="rounded-2xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-100 p-4 flex items-center justify-between dark:from-slate-900 dark:to-slate-800 dark:border-slate-700">
              <div>
                <p className="text-xs text-orange-600 font-semibold uppercase tracking-wide">Net calories</p>
                <p className="text-3xl font-black text-foreground">1,420</p>
                <p className="text-sm text-muted">of 1,800 goal</p>
                <p className="text-sm font-bold text-emerald-600 mt-1 dark:text-emerald-400">380 kcal remaining</p>
              </div>
              <div className="relative h-24 w-24 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#fde68a" strokeWidth="14" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#16a34a" strokeWidth="14"
                    strokeDasharray="239" strokeDashoffset="62" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-bold text-emerald-700 dark:text-emerald-300">380</span>
                  <span className="text-[9px] text-muted">left</span>
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
                  <p className="text-[10px] font-semibold text-muted uppercase">{m.label}</p>
                  <p className="text-sm font-black text-foreground">{m.val}</p>
                  <p className="text-[10px] text-muted">{m.target}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-white/60 overflow-hidden dark:bg-slate-800/60">
                    <div className={`h-full ${m.bar} rounded-full`} style={{ width: m.pct }} />
                  </div>
                </div>
              ))}
            </div>
            {/* Recent meals mock */}
            <div className="rounded-2xl bg-gray-50 p-3 space-y-2 dark:bg-slate-900">
              <p className="text-xs font-bold text-muted flex items-center gap-1">🥣 Breakfast <span className="ml-auto bg-orange-50 border border-orange-100 rounded-full px-2 py-0.5 text-orange-600 dark:bg-slate-800 dark:border-slate-700 dark:text-amber-300">486 kcal</span></p>
              {[
                { name: 'Poha with peanuts', kcal: 286 },
                { name: 'Chai with milk', kcal: 60 },
                { name: 'Boiled egg', kcal: 140 },
              ].map((f) => (
                <div key={f.name} className="flex justify-between text-xs bg-white rounded-lg px-3 py-2 dark:bg-slate-800">
                  <span className="text-foreground font-medium">{f.name}</span>
                  <span className="text-muted">{f.kcal} kcal</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mt-16 grid gap-4 sm:grid-cols-2">
          {[
            { emoji: '🍛', title: '600+ Indian foods', desc: 'Dal makhani, biryani, idli, paratha — all with authentic IFCT 2017 nutrition data. Searched in Hindi and English.' },
            { emoji: '⚡', title: 'Log in 5 seconds', desc: 'Recent foods + quick-add button. Copy yesterday\'s meals with one tap. Never type the same food twice.' },
            { emoji: '🏋️', title: 'Exercise tracking', desc: 'Log workouts, walks, yoga. Burned calories offset your daily goal automatically with MET-based calculation.' },
            { emoji: '💧', title: 'Water tracker', desc: 'Track glasses and bottles throughout the day with one-tap quick add. Personalized daily goal.' },
            { emoji: '📈', title: 'Weight trends', desc: 'Visualize your progress with a trend chart. See BMI, goal prediction, and weeks-to-target at a glance.' },
            { emoji: '🔥', title: 'Daily streaks', desc: 'Build the logging habit with streak badges. Hit 7, 30, 100 days — with milestone celebrations.' },
          ].map((f) => (
            <div key={f.title} className="rounded-3xl border border-orange-100 bg-white/80 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
              <span className="text-2xl">{f.emoji}</span>
              <h3 className="mt-2 text-base font-bold text-foreground">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* Free vs Pro comparison */}
        <section className="mt-16">
          <h2 className="text-2xl font-black text-foreground text-center mb-8">Simple, honest pricing</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Free */}
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Free forever</p>
              <p className="text-3xl font-black text-foreground">₹0</p>
              <p className="text-sm text-muted mt-1 mb-5">No credit card required</p>
              <ul className="space-y-2.5">
                {[
                  '5 food logs per day',
                  'Weight tracking',
                  'Exercise logging',
                  'Water tracker',
                  'Calorie + macro goals',
                  '600+ Indian foods database',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-muted">
                    <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/sign-up"
                className="mt-6 block w-full rounded-2xl border border-orange-200 bg-orange-50 py-3 text-sm font-bold text-orange-700 text-center hover:bg-orange-100 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-amber-300 dark:hover:bg-slate-700"
              >
                Start for free
              </Link>
            </div>
            {/* Pro */}
            <div className="rounded-3xl border-2 border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50 p-6 shadow-md relative overflow-hidden dark:border-amber-500/60 dark:from-slate-900 dark:to-slate-800">
              <div className="absolute top-4 right-4 rounded-full bg-orange-600 px-2.5 py-1 text-[10px] font-black text-white uppercase tracking-wide">Popular</div>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 mb-1">Pro</p>
              <p className="text-3xl font-black text-foreground">$4.99<span className="text-base font-semibold text-muted">/mo</span></p>
              <p className="text-sm text-muted mt-1 mb-5">billed $59.99/year · 7-day free trial</p>
              <ul className="space-y-2.5">
                {[
                  'Everything in Free',
                  'Unlimited food logging',
                  'Custom food & recipe builder',
                  'Full nutrition history (30+ days)',
                  'Data export (CSV)',
                  'Priority support',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-muted">
                    <CheckCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/upgrade"
                className="mt-6 block w-full rounded-2xl bg-orange-600 py-3 text-sm font-bold text-white text-center hover:bg-orange-700 transition-colors shadow-sm"
              >
                Upgrade to Pro →
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-16">
          <h2 className="text-2xl font-black text-foreground text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-3">
            {[
              {
                q: 'Does it have Indian food data?',
                a: 'Yes — 600+ Indian dishes from IFCT 2017 (Indian Food Composition Tables) including regional foods like idli, dhokla, pav bhaji, chhole, rajma, biryani and much more.',
              },
              {
                q: 'How is my calorie goal calculated?',
                a: 'Using the Mifflin-St Jeor BMR formula + your activity level and goal (lose/maintain/gain). Protein is set at 2g/kg body weight, fat at 0.8g/kg — the rest goes to carbs.',
              },
              {
                q: 'Is my data safe?',
                a: 'Yes. All data is encrypted at rest and in transit via Supabase (PostgreSQL). Each user can only see their own data. You can export or delete everything from Settings.',
              },
              {
                q: 'Does it work offline?',
                a: 'The app is a PWA (Progressive Web App) so you can install it on your phone\'s home screen. Core features work offline and sync when you reconnect.',
              },
              {
                q: 'Can I cancel my Pro subscription?',
                a: 'Yes, anytime from Settings → Manage Subscription. No lock-in. You keep access until the end of the billing period.',
              },
            ].map((faq) => (
              <details key={faq.q} className="group rounded-2xl border border-gray-100 bg-white/80 px-5 py-4 shadow-sm cursor-pointer dark:border-slate-800 dark:bg-slate-900/80">
                <summary className="list-none flex items-center justify-between font-semibold text-sm text-foreground">
                  {faq.q}
                  <span className="text-orange-600 text-lg leading-none group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mt-16 rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-8 text-center shadow-sm dark:border-amber-500/60 dark:from-slate-900 dark:to-slate-800">
          <h2 className="text-2xl font-black text-foreground">Ready to start?</h2>
          <p className="mt-2 text-sm text-muted">Join CalTrack and take control of your nutrition — the Indian way.</p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/auth/sign-up"
              className="rounded-full bg-orange-600 px-8 py-3 text-sm font-bold text-white hover:bg-orange-700 transition-colors shadow-md"
            >
              Start for free →
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted">No credit card · Cancel anytime</p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-orange-100 bg-white/60 px-5 py-8 text-center text-xs text-muted dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <span>© 2026 CalTrack · Made with ❤️ for India</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
