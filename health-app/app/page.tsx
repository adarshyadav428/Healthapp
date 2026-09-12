import type { Metadata } from 'next'
import Link from 'next/link'
import { Camera, Flame, TrendingUp, Utensils, Zap } from 'lucide-react'
import { LEGAL_NAME } from '@/lib/merchant'
import { FREE_FEATURES, PRO_FEATURES } from '@/lib/planFeatures'
import { ProductScreens } from '@/components/landing/ProductScreens'
import { Faq } from '@/components/landing/Faq'

export const metadata: Metadata = {
  title: 'GetInShape — Calorie & Weight Tracker Built for Indian Food',
  description:
    'Log meals by photo, chat, search or barcode. Calorie and macro targets, weight trends and AI coaching — tuned for Indian food and priced in ₹. Free forever, no credit card.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'GetInShape — Calorie & Weight Tracker Built for Indian Food',
    description:
      'Log meals by photo, chat, search or barcode. Built for Indian food, priced in ₹. Free forever, no credit card.',
    type: 'website',
    url: '/',
  },
}

// The two button styles on this page. Azure is the site's accent (see
// globals.css); the app's ember stays inside the product screens.
const PRIMARY =
  'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-azure-grad px-6 text-body font-semibold text-white shadow-azure tap-scale transition-[filter] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'
const SECONDARY =
  'inline-flex h-12 items-center justify-center rounded-full border border-hairline bg-surface px-6 text-body font-semibold text-ink tap-scale transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'

const DIFFERENTIATORS = [
  { icon: Utensils, title: '850+ Indian foods', body: 'Dal, roti, biryani, dosa — the everyday staples measured from IFCT 2017.' },
  { icon: Zap, title: 'Log in seconds', body: 'Recent foods, one-tap re-log, copy yesterday. Never type the same meal twice.' },
  { icon: Camera, title: 'Log with a photo', body: 'Point the camera at your plate and get an estimate you can edit before it lands.' },
  { icon: TrendingUp, title: 'See the trend', body: 'Weight, calories and a streak that shows the habit forming.' },
]

const STEPS = [
  { n: 1, title: 'Log what you ate', body: 'Search, tap a recent food, scan a barcode or take a photo.' },
  { n: 2, title: 'See where you stand', body: 'Calories left today, macros, and how the week is going against maintenance.' },
  { n: 3, title: 'Keep it going', body: 'A streak, a weekly recap and a weight trend that rewards consistency, not perfection.' },
]

const FAQ = [
  {
    q: 'Does it have Indian food data?',
    a: 'Yes — 850+ Indian dishes. The everyday staples are measured values from IFCT 2017 (Indian Food Composition Tables); regional and restaurant dishes are category-based estimates, labelled as such in search. Packaged brands come from Open Food Facts.',
  },
  {
    q: 'How is my calorie goal calculated?',
    a: 'Mifflin-St Jeor BMR plus your activity level and goal (lose, maintain or gain). Protein is set at 1.6 g per kg of body weight, fat at 0.8 g per kg, and the rest goes to carbs.',
  },
  {
    q: 'Can I install it like an app?',
    a: "Yes. It's a web app you can add to your home screen, and it's on Google Play for Android. Either way it opens full-screen and you need a connection to log and sync.",
  },
  {
    q: 'Is my data safe, and can I leave?',
    a: 'Data is encrypted in transit and at rest, and only you can see yours. You can export everything or delete your account from Profile at any time.',
  },
  {
    q: 'Can I cancel Pro?',
    a: 'Anytime, from Profile → Pro subscription. There is no lock-in; you keep access until the end of the billing period.',
  },
]

// The hero's one orchestrated moment: each line lands a beat after the last.
const rise = (i: number) => ({ animationDelay: `${i * 90}ms` })

export default function Home() {
  return (
    <div className="site min-h-screen overflow-x-hidden bg-azure-wash">
      {/* ── Header ── */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-4 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 rounded-full tap-scale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure focus-visible:ring-offset-2 focus-visible:ring-offset-canvas" aria-label="GetInShape home">
          <span className="grid h-9 w-9 place-items-center rounded-control bg-brand-soft">
            <Flame className="h-5 w-5 text-brand" strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="font-display text-title-sm font-semibold text-ink">GetInShape</span>
        </Link>
        <nav aria-label="Site" className="flex items-center gap-1 sm:gap-2">
          <a href="#pricing" className="hidden h-11 items-center px-3 text-body font-medium text-ink-2 hover:text-ink sm:inline-flex">Pricing</a>
          <a href="#faq" className="hidden h-11 items-center px-3 text-body font-medium text-ink-2 hover:text-ink sm:inline-flex">FAQ</a>
          <Link href="/auth/sign-in" className="inline-flex h-11 items-center whitespace-nowrap px-3 text-body font-medium text-ink-2 hover:text-ink">Sign in</Link>
          <Link href="/auth/sign-up" className={`${PRIMARY} h-10 whitespace-nowrap px-4 text-caption sm:h-11 sm:px-5 sm:text-body`}>Start free<span className="hidden sm:inline">&nbsp;→</span></Link>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 lg:px-8">
        {/* ── Hero ── */}
        <section className="pb-10 pt-10 text-center sm:pt-16">
          <p className="animate-fade-up text-caption font-semibold text-azure-text" style={rise(0)}>Built for India</p>
          <h1 className="mx-auto mt-3 max-w-3xl animate-fade-up font-display text-display font-semibold text-ink sm:text-hero lg:text-hero-lg" style={rise(1)}>
            Track your food.<br />
            See your progress.<br />
            <span className="text-azure-text">Stay consistent.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-lg animate-fade-up text-body-lg text-ink-2" style={rise(2)}>
            A simple calorie and weight tracker built for India. Log dal, roti or biryani in seconds, and watch the trend move.
          </p>
          <div className="mt-8 flex animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row" style={rise(3)}>
            <Link href="/auth/sign-up" className={`${PRIMARY} w-full sm:w-auto`}>Start for free</Link>
            <Link href="/auth/sign-in" className={`${SECONDARY} w-full sm:w-auto`}>Sign in</Link>
          </div>
          <p className="mt-4 animate-fade-up text-caption text-ink-3" style={rise(4)}>Free forever · No credit card · Web and Android</p>
        </section>

        {/* ── The product ── */}
        <section aria-label="The app" className="animate-fade-up pb-6 lg:pb-12" style={rise(5)}>
          <ProductScreens />
        </section>

        {/* ── Differentiators ── */}
        <section aria-label="Why GetInShape" className="mx-auto grid max-w-5xl gap-8 py-16 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
          {DIFFERENTIATORS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="text-center sm:text-left">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-azure-soft text-azure sm:mx-0">
                <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-title-sm font-semibold text-ink">{title}</h2>
              <p className="mt-1.5 text-body text-ink-2">{body}</p>
            </div>
          ))}
        </section>

        {/* ── How it works ── */}
        <section aria-label="How it works" className="border-t border-hairline py-16">
          <h2 className="text-center font-display text-title-lg font-semibold text-ink">Three things, every day</h2>
          <ol className="mx-auto mt-10 grid max-w-4xl gap-8 sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="text-center sm:text-left">
                <span className="font-display text-display font-semibold tabular-nums leading-none text-azure-text">{s.n}</span>
                <h3 className="mt-3 text-title-sm font-semibold text-ink">{s.title}</h3>
                <p className="mt-1.5 text-body text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Founder ── */}
        <section aria-label="From the founder" className="border-t border-hairline py-16">
          <figure className="mx-auto max-w-3xl">
            <blockquote className="font-display text-title-lg font-semibold leading-tight text-ink">
              &ldquo;Every app I tried had generic food data. My dal, my roti, my sabzi — none of it was there.&rdquo;
            </blockquote>
            <p className="mt-5 max-w-2xl text-body text-ink-2">
              I&apos;m an engineering student running a medical store in UP, and I wanted to lose weight without guessing.
              So I built the tracker I needed: 850+ Indian foods, the everyday staples measured from IFCT 2017, and I log
              in it every day.
            </p>
            <figcaption className="mt-6 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-surface-2 font-display text-body-lg font-semibold text-ink" aria-hidden="true">A</span>
              <span>
                <span className="block text-body font-semibold text-ink">Adarsh Yadav</span>
                <span className="block text-caption text-ink-3">Founder · Azamgarh, UP</span>
              </span>
            </figcaption>
          </figure>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" aria-label="Pricing" className="scroll-mt-6 border-t border-hairline py-16">
          <h2 className="text-center font-display text-title-lg font-semibold text-ink">Simple pricing</h2>
          <p className="mt-2 text-center text-body text-ink-2">Start free. Go Pro when you want the whole history and unlimited AI.</p>
          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2">
            <div className="rounded-card-lg border border-hairline bg-surface p-6 shadow-air">
              <p className="text-caption font-semibold text-ink-2">Free</p>
              <p className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-display font-semibold tabular-nums leading-none text-ink">₹0</span>
                <span className="text-caption text-ink-3">forever</span>
              </p>
              <ul className="mt-6 divide-y divide-hairline border-t border-hairline">
                {FREE_FEATURES.map((f) => <li key={f} className="py-2.5 text-caption text-ink-2">{f}</li>)}
              </ul>
              <Link href="/auth/sign-up" className={`${SECONDARY} mt-6 w-full`}>Start for free</Link>
            </div>
            <div className="rounded-card-lg border-2 border-azure bg-surface p-6 shadow-air">
              <p className="text-caption font-semibold text-azure-text">Pro</p>
              <p className="mt-2 flex items-baseline gap-1">
                <span className="font-display text-display font-semibold tabular-nums leading-none text-ink">₹299</span>
                <span className="text-caption text-ink-3">a month · or ₹1,999 a year</span>
              </p>
              <ul className="mt-6 divide-y divide-hairline border-t border-hairline">
                <li className="py-2.5 text-caption font-semibold text-ink">Everything in Free, plus</li>
                {PRO_FEATURES.map((f) => <li key={f} className="py-2.5 text-caption text-ink-2">{f}</li>)}
              </ul>
              <Link href="/upgrade" className={`${PRIMARY} mt-6 w-full`}>Go Pro</Link>
            </div>
          </div>
          <p className="mt-6 text-center text-caption text-ink-3">Billed in ₹ through Razorpay on the web and Google Play on Android. Cancel anytime.</p>
        </section>

        {/* ── FAQ ── */}
        <section id="faq" aria-label="Questions" className="mx-auto max-w-3xl scroll-mt-6 border-t border-hairline py-16">
          <h2 className="font-display text-title-lg font-semibold text-ink">Questions</h2>
          <div className="mt-8">
            <Faq items={FAQ} />
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section aria-label="Get started" className="border-t border-hairline py-20 text-center">
          <h2 className="font-display text-title-lg font-semibold text-ink sm:text-display">Ready to get in shape?</h2>
          <p className="mt-3 text-body-lg text-ink-2">Free to start. Takes a minute.</p>
          <Link href="/auth/sign-up" className={`${PRIMARY} mt-8`}>Start for free</Link>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-hairline">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-5 py-8 text-caption text-ink-3 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>© 2026 GetInShape · {LEGAL_NAME}</p>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/pricing" className="hover:text-ink">Pricing</Link>
            <Link href="/contact" className="hover:text-ink">Contact</Link>
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/refunds" className="hover:text-ink">Refunds</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
