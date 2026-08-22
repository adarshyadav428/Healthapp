import Link from 'next/link'
import { CheckCircle, Flame } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-control bg-brand-soft">
            <Flame className="h-[18px] w-[18px] text-brand" strokeWidth={2.2} />
          </div>
          <span className="font-display text-xl font-bold text-ink tracking-tight">GetInShape</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/sign-in" className="text-sm font-medium text-ink-2 hover:text-ink transition-colors">
            Sign in
          </Link>
          <Link
            href="/auth/sign-up"
            className="rounded-full bg-brand px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition-opacity shadow-rest"
          >
            Start free
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-5 pb-24">
        {/* Hero */}
        <section className="py-10 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1 text-xs font-semibold text-ink-2 mb-6">
            🇮🇳 Built for Indian diets &middot; 850+ desi foods included
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight text-ink sm:text-5xl">
            Track calories the<br />
            <span className="text-brand-ink">Indian way</span>
          </h1>
          <p className="mx-auto mt-4 max-w-md text-base text-ink-2">
            Dal, roti, biryani, dosa — with accurate IFCT 2017 nutrition data.
            Log food in 5 seconds. See your macros, weight trend and calorie deficit — all in one place.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/auth/sign-up"
              className="rounded-full bg-brand px-8 py-3 text-base font-bold text-white hover:opacity-90 transition-opacity shadow-float"
            >
              Start for free →
            </Link>
            <Link
              href="/auth/sign-in"
              className="rounded-full border border-hairline bg-surface px-8 py-3 text-base font-semibold text-ink hover:bg-surface-2 transition-colors"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-3 text-xs text-ink-2">Free forever · No credit card · Installs like an app</p>
        </section>

        {/* App preview mockup */}
        <section className="mx-auto max-w-sm">
          <div className="rounded-sheet border border-hairline bg-surface p-5 shadow-float space-y-3">
            {/* Calorie ring mock */}
            <div className="rounded-card bg-surface border border-hairline p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-ink-2 font-semibold uppercase tracking-wide">Calories today</p>
                <p className="font-display text-3xl font-bold text-ink tabular-nums">1,420</p>
                <p className="text-sm text-ink-2">of 1,800 goal</p>
                <p className="text-sm font-bold text-good mt-1">380 kcal remaining</p>
              </div>
              <div className="relative h-24 w-24 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                  <circle cx="50" cy="50" r="38" fill="none" stroke="var(--surface-2)" strokeWidth="14" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke="var(--energy)" strokeWidth="14"
                    strokeDasharray="239" strokeDashoffset="62" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-bold text-energy-ink tabular-nums">380</span>
                  <span className="text-[9px] text-ink-2">left</span>
                </div>
              </div>
            </div>
            {/* Macro cards mock */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Protein', val: '95g', target: '/120g', color: 'var(--protein)', pct: '79%' },
                { label: 'Carbs', val: '180g', target: '/200g', color: 'var(--carbs)', pct: '90%' },
                { label: 'Fat', val: '42g', target: '/55g', color: 'var(--fat)', pct: '76%' },
              ].map((m) => (
                <div key={m.label} className="rounded-control bg-surface-2 p-2">
                  <p className="text-[10px] font-semibold text-ink-2 uppercase">{m.label}</p>
                  <p className="text-sm font-bold text-ink tabular-nums">{m.val}</p>
                  <p className="text-[10px] text-ink-2">{m.target}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-surface overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: m.pct, background: m.color }} />
                  </div>
                </div>
              ))}
            </div>
            {/* Recent meals mock */}
            <div className="rounded-card bg-surface-2 p-3 space-y-2">
              <p className="text-xs font-bold text-ink-2 flex items-center gap-1">
                🥣 Breakfast
                <span className="ml-auto text-xs font-semibold text-ink">486 kcal</span>
              </p>
              {[
                { name: 'Poha with peanuts', kcal: 286 },
                { name: 'Chai with milk', kcal: 60 },
                { name: 'Boiled egg', kcal: 140 },
              ].map((f) => (
                <div key={f.name} className="flex justify-between text-xs bg-surface rounded-control px-3 py-2">
                  <span className="text-ink font-medium">{f.name}</span>
                  <span className="text-ink-2 tabular-nums">{f.kcal} kcal</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mt-16 grid gap-4 sm:grid-cols-2">
          {[
            { emoji: '🍛', title: '850+ Indian foods', desc: 'Dal makhani, biryani, idli, paratha — with 225 staples measured from IFCT 2017 and the long tail estimated and clearly labelled. Searched in Hindi and English.' },
            { emoji: '⚡', title: 'Log in 5 seconds', desc: "Recent foods + quick-add button. Copy yesterday's meals with one tap. Never type the same food twice." },
            { emoji: '🏋️', title: 'Exercise tracking', desc: 'Log workouts, walks and yoga with MET-based calorie estimates.' },
            { emoji: '📸', title: 'AI photo scan', desc: 'Point your camera at your plate. Gemini identifies the dish and estimates portions, tuned for Indian home cooking.' },
            { emoji: '📈', title: 'Weight trends', desc: 'Visualize your progress with a trend chart. See BMI, goal prediction, and weeks-to-target at a glance.' },
            { emoji: '🔥', title: 'Daily streaks', desc: 'Build the logging habit with streak badges. Hit 7, 30, 100 days — with milestone celebrations.' },
          ].map((f) => (
            <div key={f.title} className="rounded-sheet border border-hairline bg-surface p-5 shadow-rest">
              <span className="text-2xl">{f.emoji}</span>
              <h3 className="mt-2 text-base font-bold text-ink">{f.title}</h3>
              <p className="mt-1 text-sm text-ink-2">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* Founder story */}
        <section className="mt-16">
          <div className="rounded-sheet border border-hairline bg-surface bg-hero-wash p-6 shadow-rest relative overflow-hidden">
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-ink mb-4">
                👤 Why I built this
              </div>
              <blockquote className="font-display text-lg font-bold text-ink leading-snug mb-4">
                &ldquo;Every app I tried had generic food data. My dal, my roti, my sabzi — none of it was there.&rdquo;
              </blockquote>
              <p className="text-sm text-ink-2 leading-relaxed mb-4">
                I&apos;m Adarsh — engineering student, running a medical store in UP, and on a personal mission to
                lose weight the right way. HealthifyMe didn&apos;t have accurate data for the food I actually eat.
                MyFitnessPal is built for the West. So I built GetInShape: 850+ Indian foods, with the 225
                everyday staples measured from IFCT 2017 — the same database nutrition researchers use.
              </p>
              <p className="text-sm text-ink-2 leading-relaxed mb-5">
                I&apos;m using this app every single day. Every bug I fix, every food I add — it&apos;s because
                I need it myself. That&apos;s the only way to build something that actually works.
              </p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-brand flex items-center justify-center text-white font-bold text-sm shrink-0">
                  A
                </div>
                <div>
                  <p className="text-sm font-bold text-ink">Adarsh Yadav</p>
                  <p className="text-xs text-ink-2">Founder · Azamgarh, UP 🇮🇳</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Free vs Pro comparison */}
        <section className="mt-16">
          <h2 className="font-display text-2xl font-bold text-ink text-center mb-8">Simple, honest pricing</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Free */}
            <div className="rounded-sheet border border-hairline bg-surface p-6 shadow-rest">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-2 mb-1">Free forever</p>
              <p className="font-display text-3xl font-bold text-ink">₹0</p>
              <p className="text-sm text-ink-2 mt-1 mb-5">No credit card required</p>
              <ul className="space-y-2.5">
                {[
                  'Full calorie & macro tracking',
                  'Weight tracking',
                  'Exercise logging',
                  'Barcode scanning',
                  '3 free AI scans when you confirm your email',
                  'Calorie + macro goals',
                  '850+ Indian foods database',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-ink-2">
                    <CheckCircle className="h-4 w-4 text-good flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/sign-up"
                className="mt-6 block w-full rounded-control border border-hairline bg-canvas py-3 text-sm font-bold text-ink text-center hover:bg-surface-2 transition-colors"
              >
                Start for free
              </Link>
            </div>
            {/* Pro */}
            <div className="rounded-sheet border-2 border-brand bg-brand-soft p-6 shadow-float relative overflow-hidden">
              <div className="absolute top-4 right-4 rounded-full bg-energy px-2.5 py-1 text-[10px] font-bold text-energy-ink uppercase tracking-wide">Popular</div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-ink mb-1">Pro</p>
              <p className="font-display text-3xl font-bold text-ink">₹299<span className="text-base font-semibold text-ink-2">/mo</span></p>
              <p className="text-sm text-ink-2 mt-1 mb-5">or ₹1,999/year · save 44%</p>
              <ul className="space-y-2.5">
                {[
                  'Everything in Free',
                  'Unlimited AI photo & chat logging',
                  'Custom food & recipe builder',
                  'Full nutrition history (30+ days)',
                  'Weekly AI recap',
                  'Priority email support',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-ink-2">
                    <CheckCircle className="h-4 w-4 text-brand flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/upgrade"
                className="mt-6 block w-full rounded-control bg-brand py-3 text-sm font-bold text-white text-center hover:opacity-90 transition-opacity shadow-rest"
              >
                Upgrade to Pro →
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-16">
          <h2 className="font-display text-2xl font-bold text-ink text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-3">
            {[
              {
                q: 'Does it have Indian food data?',
                a: 'Yes — 850+ Indian dishes. The 225 everyday staples are measured values from IFCT 2017 (Indian Food Composition Tables); the long tail of regional and restaurant dishes — idli, dhokla, pav bhaji, chhole, rajma, biryani — are category-based estimates, and we label those "📊 Estimated" in search so you always know which is which. Packaged brands come from Open Food Facts.',
              },
              {
                q: 'How is my calorie goal calculated?',
                a: 'Using the Mifflin-St Jeor BMR formula + your activity level and goal (lose/maintain/gain). Protein is set at 1.6g/kg body weight, fat at 0.8g/kg — the rest goes to carbs.',
              },
              {
                q: 'Is my data safe?',
                a: 'Yes. All data is encrypted at rest and in transit via Supabase (PostgreSQL). Each user can only see their own data. You can export or delete everything from Settings.',
              },
              {
                q: 'Can I install it like an app?',
                a: "Yes — it's a PWA (Progressive Web App), so you can add it to your phone's home screen and it opens full-screen like a native app. You'll need an internet connection to log and sync your data.",
              },
              {
                q: 'Can I cancel my Pro subscription?',
                a: 'Yes, anytime from Settings → Manage Subscription. No lock-in. You keep access until the end of the billing period.',
              },
            ].map((faq) => (
              <details key={faq.q} className="group rounded-card border border-hairline bg-surface px-5 py-4 shadow-rest cursor-pointer">
                <summary className="list-none flex items-center justify-between font-semibold text-sm text-ink">
                  {faq.q}
                  <span className="text-ink-2 text-lg leading-none group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-3 text-sm text-ink-2 leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="mt-16 rounded-sheet border border-hairline bg-surface p-8 text-center shadow-rest">
          <h2 className="font-display text-2xl font-bold text-ink">Ready to start?</h2>
          <p className="mt-2 text-sm text-ink-2">Join GetInShape and take control of your nutrition — the Indian way.</p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/auth/sign-up"
              className="rounded-full bg-brand px-8 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity shadow-rest"
            >
              Start for free →
            </Link>
          </div>
          <p className="mt-3 text-xs text-ink-2">No credit card · Cancel anytime</p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-hairline bg-surface px-5 py-8 text-center text-xs text-ink-2">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <span>© 2026 GetInShape · Operated by Adarsh Yadav · Made with ❤️ for India</span>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/pricing" className="hover:text-ink transition-colors">Pricing</Link>
            <Link href="/refunds" className="hover:text-ink transition-colors">Refunds</Link>
            <Link href="/contact" className="hover:text-ink transition-colors">Contact Us</Link>
            <Link href="/privacy" className="hover:text-ink transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-ink transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
