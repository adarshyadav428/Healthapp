import Link from 'next/link'
import { Button } from '../components/ui/button'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-white">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="rounded-xl bg-blue-600/10 px-3 py-1 text-blue-700">CalTrack</span>
          <span className="text-gray-900">Track smarter</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/sign-in" className="text-sm text-gray-700 hover:text-gray-900">Sign in</Link>
          <Button asChild className="rounded-full px-5">
            <Link href="/auth/sign-up">Start for free</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 pb-20">
        <section className="grid gap-10 rounded-3xl border border-gray-100 bg-white p-10 shadow-sm md:grid-cols-2">
          <div className="space-y-6">
            <h1 className="text-4xl font-bold leading-tight text-gray-900">
              Track your calories. Lose weight. Actually stick to it.
            </h1>
            <p className="text-base text-gray-600">
              The fastest food logger on the web. No paywalls on the basics.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild className="rounded-full px-6">
                <Link href="/auth/sign-up">Start for free</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full px-6">
                <Link href="/auth/sign-in">Sign in</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-3xl border border-gray-100 bg-gradient-to-br from-blue-50 via-white to-blue-100 p-6">
            <div className="space-y-4">
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs text-gray-500">Today</p>
                <p className="text-3xl font-black text-gray-900">1,450 / 2,000 kcal</p>
                <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
                  <div className="h-2 w-3/4 rounded-full bg-green-500" />
                </div>
              </div>
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <p className="text-xs text-gray-500">Streak</p>
                <p className="text-2xl font-semibold text-gray-900">🔥 7 days</p>
                <p className="text-sm text-gray-500">Keep the momentum going.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            { title: 'Log a meal in 10 seconds', text: 'Search, tap, and log. Built for speed.' },
            { title: 'See your progress clearly', text: 'Simple charts and smart summaries.' },
            { title: 'Build a habit with streaks', text: 'Turn consistency into motivation.' },
          ].map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{feature.text}</p>
            </div>
          ))}
        </section>

        <section className="mt-16 rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Upgrade to Pro</h2>
              <p className="text-sm text-gray-500">Unlock unlimited logs and deeper insights.</p>
            </div>
            <Button asChild className="rounded-full px-6">
              <Link href="/upgrade">See plans</Link>
            </Button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { name: 'Monthly', price: '$9.99', note: 'Billed monthly' },
              { name: 'Annual', price: '$59.99', note: 'Save 50%' },
              { name: 'Lifetime', price: '$129.99', note: 'One-time' },
            ].map((plan) => (
              <div key={plan.name} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm text-gray-500">{plan.name}</p>
                <p className="text-2xl font-semibold text-gray-900">{plan.price}</p>
                <p className="text-xs text-gray-500">{plan.note}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 pb-10 text-sm text-gray-500">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>Contact: hello@caltrack.app</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-gray-700">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-700">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
