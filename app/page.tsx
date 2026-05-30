import Link from 'next/link'
import { CheckCircle } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden dark:bg-slate-950">
      {/* Subtle gradient blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.08),_transparent_50%),radial-gradient(circle_at_bottom_left,_rgba(99,102,241,0.05),_transparent_50%)] dark:opacity-60" />

      {/* Header */}
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🥗</span>
          <span className="text-xl font-black text-foreground tracking-tight">GetInShape</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/sign-in" className="text-sm font-medium text-muted hover:text-foreground transition-colors">
            Sign in
          </Link>
          <Link
            href="/auth/sign-up"
            className="rounded-full bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 transition-colors shadow-md shadow-orange-500/25"
          >
            Start free
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 pb-24">
        {/* Hero */}
        <section className="py-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted mb-6">
            🇮🇳 Built for Indian diets &middot; 600+ desi foods included
          </div>
          <h1 className="text-4xl font-black leading-tight text-foreground sm:text-5xl">
            Track calories the<br />
            <span className="text-orange-500">Indian way</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base text-muted">
            Dal, roti, biryani, dosa — with accurate IFCT 2017 nutrition data.
            Log food in 5 seconds. See your macros, weight trend and calorie deficit — all in one place.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/auth/sign-up"
              className="rounded-full bg-orange-500 px-8 py-3 text-base font-bold text-white hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/25"
            >
              Start for free →
            </Link>
            <Link
              href="/auth/sign-in"
              className="rounded-full border border-border bg-card px-8 py-3 text-base font-semibold text-foreground hover:bg-slate-50 transition-colors dark:hover:bg-slate-800"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted">Free forever · No credit card · Works offline</p>
        </section>

        {/* App preview mockup */}
        <section className="mx-auto max-w-sm">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-xl space-y-3 dark:border-slate-800 dark:bg-slate-900/80">
            {/* Calorie ring mock */}
            <div className="rounded-2xl bg-card border border-border p-4 flex items-center justify-between dark:border-slate-700">
              <div>
                <p className="text-xs text-muted font-semibold uppercase tracking-wide">Net calories</p>
                <p className="text-3xl font-black text-foreground">1,420</p>
                <p className="text-sm text-muted">of 1,800 goal</p>
                <p className="text-sm font-bold text-emerald-600 mt-1 dark:text-emerald-400">380 kcal remaining</p>
              </div>
              <div className="relative h-24 w-24 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#e0e7ff" strokeWidth="14" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#6366f1" strokeWidth="14"
                    strokeDasharray="239" strokeDashoffset="62" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-bold text-indigo-700 dark:text-indigo-300">380</span>
                  <span className="text-[9px] text-muted">left</span>
                </div>
              </div>
            </div>
            {/* Macro cards mock */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Protein', val: '95g', target: '/120g', bg: 'bg-indigo-50 dark:bg-indigo-950/30', bar: 'bg-indigo-500', pct: '79%' },
                { label: 'Carbs', val: '180g', target: '/200g', bg: 'bg-amber-50 dark:bg-amber-950/30', bar: 'bg-amber-400', pct: '90%' },
                { label: 'Fat', val: '42g', target: '/55g', bg: 'bg-rose-50 dark:bg-rose-950/30', bar: 'bg-rose-400', pct: '76%' },
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
            <div className="rounded-2xl bg-slate-50 p-3 space-y-2 dark:bg-slate-800/50">
              <p className="text-xs font-bold text-muted flex items-center gap-1">
                🥣 Breakfast
                <span className="ml-auto text-xs font-semibold text-foreground">486 kcal</span>
              </p>
              {[
                { name: 'Poha with peanuts', kcal: 286 },
                { name: 'Chai with milk', kcal: 60 },
                { name: 'Boiled egg', kcal: 140 },
              ].map((f) => (
                <div key={f.name} className="flex justify-between text-xs bg-card rounded-lg px-3 py-2 dark:bg-slate-800">
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
            { emoji: '⚡', title: 'Log in 5 seconds', desc: "Recent foods + quick-add button. Copy yesterday's meals with one tap. Never type the same food twice." },
            { emoji: '🏋️', title: 'Exercise tracking', desc: 'Log workouts, walks, yoga. Burned calories offset your daily goal automatically with MET-based calculation.' },
            { emoji: '💧', title: 'Water tracker', desc: 'Track glasses and bottles throughout the day with one-tap quick add. Personalized daily goal.' },
            { emoji: '📈', title: 'Weight trends', desc: 'Visualize your progress with a trend chart. See BMI, goal prediction, and weeks-to-target at a glance.' },
            { emoji: '🔥', title: 'Daily streaks', desc: 'Build the logging habit with streak badges. Hit 7, 30, 100 days — with milestone celebrations.' },
          ].map((f) => (
            <div key={f.title} className="rounded-3xl border border-border bg-card p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
              <span className="text-2xl">{f.emoji}</span>
              <h3 className="mt-2 text-base font-bold text-foreground">{f.title}</h3>
              <p className="mt-1 text-sm text-muted">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* Founder story */}
        <section className="mt-16">
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 relative overflow-hidden">
            {/* Subtle orange glow */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(234,88,12,0.07),_transparent_60%)]" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 mb-4 dark:border-orange-900/40 dark:bg-orange-950/20 dark:text-orange-400">
                👤 Why I built this
              </div>
              <blockquote className="text-lg font-black text-foreground leading-snug mb-4">
                &ldquo;Every app I tried had generic food data. My dal, my roti, my sabzi — none of it was there.&rdquo;
              </blockquote>
              <p className="text-sm text-muted leading-relaxed mb-4">
                I&apos;m Adarsh — engineering student, running a medical store in UP, and on a personal mission to
                lose weight the right way. HealthifyMe didn&apos;t have accurate data for the food I actually eat.
                MyFitnessPal is built for the West. So I built GetInShape: 600+ Indian foods from IFCT 2017,
                the same database nutrition researchers use.
              </p>
              <p className="text-sm text-muted leading-relaxed mb-5">
                I&apos;m using this app every single day. Every bug I fix, every food I add — it&apos;s because
                I need it myself. That&apos;s the only way to build something that actually works.
              </p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                  A
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Adarsh Yadav</p>
                  <p className="text-xs text-muted">Founder · Azamgarh, UP 🇮🇳</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Free vs Pro comparison */}
        <section className="mt-16">
          <h2 className="text-2xl font-black text-foreground text-center mb-8">Simple, honest pricing</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Free */}
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-1">Free forever</p>
              <p className="text-3xl font-black text-foreground">₹0</p>
              <p className="text-sm text-muted mt-1 mb-5">No credit card required</p>
              <ul className="space-y-2.5">
                {[
                  'Full calorie & macro tracking',
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
                className="mt-6 block w-full rounded-2xl border border-border bg-background py-3 text-sm font-bold text-foreground text-center hover:bg-slate-50 transition-colors dark:hover:bg-slate-800"
              >
                Start for free
              </Link>
            </div>
            {/* Pro */}
            <div className="rounded-3xl border-2 border-indigo-400 bg-gradient-to-br from-indigo-50 to-violet-50 p-6 shadow-md relative overflow-hidden dark:border-indigo-500/60 dark:from-indigo-950/30 dark:to-violet-950/30">
              <div className="absolute top-4 right-4 rounded-full bg-indigo-600 px-2.5 py-1 text-[10px] font-black text-white uppercase tracking-wide">Popular</div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-1">Pro</p>
              <p className="text-3xl font-black text-foreground">₹199<span className="text-base font-semibold text-muted">/mo</span></p>
              <p className="text-sm text-muted mt-1 mb-5">or ₹699/year · save 71%</p>
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
                    <CheckCircle className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/upgrade"
                className="mt-6 block w-full rounded-2xl bg-orange-500 py-3 text-sm font-bold text-white text-center hover:bg-orange-600 transition-colors shadow-sm shadow-orange-500/25"
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
                a: "The app is a PWA (Progressive Web App) so you can install it on your phone's home screen. Core features work offline and sync when you reconnect.",
              },
              {
                q: 'Can I cancel my Pro subscription?',
                a: 'Yes, anytime from Settings → Manage Subscription. No lock-in. You keep access until the end of the billing period.',
              },
            ].map((faq) => (
              <details key={faq.q} className="group rounded-2xl border border-border bg-card px-5 py-4 shadow-sm cursor-pointer dark:border-slate-800 dark:bg-slate-900/80">
                <summary className="list-none flex items-center justify-between font-semibold text-sm text-foreground">
                  {faq.q}
                  <span className="text-muted text-lg leading-none group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mt-16 rounded-3xl border border-border bg-card p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <h2 className="text-2xl font-black text-foreground">Ready to start?</h2>
          <p className="mt-2 text-sm text-muted">Join GetInShape and take control of your nutrition — the Indian way.</p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/auth/sign-up"
              className="rounded-full bg-orange-500 px-8 py-3 text-sm font-bold text-white hover:bg-orange-600 transition-colors shadow-md shadow-orange-500/25"
            >
              Start for free →
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted">No credit card · Cancel anytime</p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/60 px-5 py-8 text-center text-xs text-muted dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <span>© 2026 GetInShape · Made with ❤️ for India</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
