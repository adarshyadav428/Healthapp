'use client'

import { useState } from 'react'
import { Button } from '../../components/ui/button'
import { toast } from '../../components/ui/use-toast'
import Link from 'next/link'
import { Check, Crown, Zap, ArrowLeft } from 'lucide-react'

const plans = [
  {
    id: 'monthly' as const,
    title: 'Monthly',
    price: '$9.99',
    per: '/month',
    note: 'Cancel anytime',
    badge: null,
    cta: 'Start Monthly',
    highlight: false,
  },
  {
    id: 'annual' as const,
    title: 'Annual',
    price: '$4.99',
    per: '/month',
    note: 'Billed $59.99/year · 7-day free trial',
    badge: 'Best value — Save 50%',
    cta: 'Start Annual Free Trial',
    highlight: true,
  },
  {
    id: 'lifetime' as const,
    title: 'Lifetime',
    price: '$129.99',
    per: 'one time',
    note: 'Pay once, use forever',
    badge: null,
    cta: 'Get Lifetime Access',
    highlight: false,
  },
]

const FEATURES = [
  'Unlimited food logs (free = 5/day)',
  'Exercise & workout logging',
  'Full Indian food database (300+ dishes)',
  'Weight trend charts',
  'Copy yesterday\'s meals',
  'Water intake tracking',
  'Advanced macro analytics',
  'Export data to CSV',
  'Priority support',
  'No ads, ever',
]

export default function UpgradePage() {
  const [loading, setLoading] = useState<string | null>(null)

  const startCheckout = async (plan: typeof plans[number]['id']) => {
    if (loading) return
    setLoading(plan)
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      window.location.href = data.url
    } catch (err) {
      toast({ title: 'Checkout failed', description: (err as Error).message, variant: 'error' })
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-background dark:bg-slate-950">

      <div className="mx-auto w-full max-w-lg px-4 py-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-700 mb-3 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-400">
            <Crown className="h-3.5 w-3.5" />
            CalTrack Pro
          </div>
          <h1 className="text-3xl font-black text-foreground">Upgrade to Pro</h1>
          <p className="mt-2 text-sm text-muted">Everything you need to hit your goals, nothing you don&apos;t.</p>
        </div>

        {/* Features */}
        <div className="rounded-3xl border border-border bg-card p-5 mb-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <p className="text-sm font-bold text-foreground">What you get with Pro</p>
          </div>
          <ul className="space-y-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-muted">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <Check className="h-3 w-3 text-emerald-600" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Plans */}
        <div className="space-y-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-3xl border p-5 shadow-sm transition-all ${
                plan.highlight
                  ? 'border-indigo-300 bg-gradient-to-br from-indigo-50 to-violet-50 ring-2 ring-indigo-200 dark:border-indigo-500/60 dark:from-indigo-950/30 dark:to-violet-950/30 dark:ring-indigo-500/20'
                  : 'border-border bg-card dark:border-slate-800 dark:bg-slate-900/90'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{plan.title}</p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-3xl font-black text-foreground">{plan.price}</span>
                    <span className="text-sm text-muted">{plan.per}</span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">{plan.note}</p>
                </div>
                {plan.badge && (
                  <span className="rounded-full bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white">
                    {plan.badge}
                  </span>
                )}
              </div>
              <Button
                className={`mt-4 w-full rounded-full font-bold ${
                  plan.highlight
                    ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/25'
                    : 'bg-gray-900 hover:bg-gray-800 text-white dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-100'
                }`}
                onClick={() => startCheckout(plan.id)}
                disabled={!!loading}
              >
                {loading === plan.id ? 'Opening checkout...' : plan.cta}
              </Button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center space-y-2">
          <p className="text-xs text-muted">Secured by Stripe · Cancel anytime · 30-day money back</p>
          <div className="flex justify-center gap-4 text-xs text-muted">
            <Link href="/terms" className="underline hover:text-foreground">Terms</Link>
            <Link href="/privacy" className="underline hover:text-foreground">Privacy</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
