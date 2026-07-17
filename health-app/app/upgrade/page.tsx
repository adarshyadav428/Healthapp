'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import Script from 'next/script'
import { Button } from '../../components/ui/button'
import { toast } from '../../components/ui/use-toast'
import Link from 'next/link'
import { Check, Crown, Zap, ArrowLeft, Lock } from 'lucide-react'
import { useUser } from '../../hooks/useUser'
import { projectGoalDate, formatGoalDate } from '../../lib/projection'
import { isPlayBillingAvailable, getPlayPrices, purchasePlan } from '../../lib/play/billing'
import { PLAY_PRODUCTS } from '../../lib/play/products'

type RazorpaySuccessResponse = {
  razorpay_payment_id: string
  razorpay_subscription_id: string
  razorpay_signature: string
}

declare global {
  interface Window {
    Razorpay: new (options: {
      key: string
      subscription_id: string
      name: string
      description: string
      prefill?: { email?: string }
      theme?: { color: string }
      handler: (response: RazorpaySuccessResponse) => void
      modal?: { ondismiss?: () => void }
    }) => { open: () => void }
  }
}

const REASON_COPY: Record<string, { title: string; description: string }> = {
  history:            { title: 'Unlock your full history', description: 'Free users can view the last 7 days. Pro shows everything.' },
  custom_foods:       { title: 'Create custom foods',      description: 'Log your home-cooked dishes and family recipes with Pro.' },
  ai_insights:        { title: 'Get your weekly AI recap', description: 'A summary of your week — calories, days logged, weight change — every Sunday.' },
  exports:            { title: 'Export your data',         description: 'Download your full log as CSV with Pro.' },
  camera_scan_limit:  { title: 'Out of photo scans for today', description: "You've used today's 5 free camera scans. Pro gives you unlimited." },
  chat_scan_limit:    { title: 'Out of chat logs for today',   description: "You've used today's 10 free chat logs. Pro gives you unlimited." },
  free_logs:          { title: "You're building a real habit", description: 'Keep the momentum — Pro unlocks your full history, unlimited AI logging and custom foods.' },
}

const plans = [
  {
    id: 'monthly' as const,
    title: 'Monthly',
    price: '₹199',
    per: '/month',
    note: 'Cancel anytime',
    badge: null,
    cta: 'Start Monthly',
    highlight: false,
  },
  {
    id: 'annual' as const,
    title: 'Annual',
    price: '₹699',
    per: '/year',
    note: 'Billed ₹699/year · Save ₹1,689',
    badge: 'Best value — Save 71%',
    cta: 'Get Annual Plan',
    highlight: true,
  },
]

const FEATURES = [
  'Unlimited AI photo & chat logging',
  'Weekly AI recap — your week summarised every Sunday',
  'Full history — beyond the last 7 days',
  'Custom foods & recipes — log your home-cooked dishes',
  'Advanced trends — full weight history, macro breakdown charts',
  'Priority email support',
  'No ads, ever',
]

function ReasonBanner() {
  const searchParams = useSearchParams()
  const reason = searchParams.get('reason')
  const reasonCopy = reason ? REASON_COPY[reason] : null
  if (!reasonCopy) return null
  return (
    <div className="rounded-card border border-hairline bg-energy-soft p-4 mb-6 flex items-start gap-3">
      <Lock className="h-5 w-5 text-energy-ink flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-bold text-ink">{reasonCopy.title}</p>
        <p className="text-xs text-energy-ink mt-0.5">{reasonCopy.description}</p>
      </div>
    </div>
  )
}

const PLAY_PRODUCT_FOR_PLAN: Record<'monthly' | 'annual', string> = {
  monthly: PLAY_PRODUCTS.monthly,
  annual: PLAY_PRODUCTS.annual,
}

export default function UpgradePage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user, profile } = useUser()
  const [loading, setLoading] = useState<string | null>(null)

  // Projected goal-date teaser (Cal AI's conversion trick) — Pro sells the curve.
  const projection =
    profile && profile.goal !== 'maintain' && profile.current_weight_kg && profile.target_weight_kg
      ? projectGoalDate(profile.current_weight_kg, profile.target_weight_kg, profile.pace_kg_per_week ?? 0.5)
      : null
  // null = still detecting, true = inside Play TWA, false = web (use Stripe)
  const [playAvailable, setPlayAvailable] = useState<boolean | null>(null)
  const [playPrices, setPlayPrices] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true
    isPlayBillingAvailable().then(async (available) => {
      if (!active) return
      setPlayAvailable(available)
      if (available) setPlayPrices(await getPlayPrices())
    })
    return () => {
      active = false
    }
  }, [])

  // Google Play Billing path (inside the TWA) — verify happens server-side.
  const startPlayPurchase = async (plan: 'monthly' | 'annual') => {
    const result = await purchasePlan(PLAY_PRODUCT_FOR_PLAN[plan])
    if (result.ok) {
      queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] })
      toast({ title: 'Welcome to Pro!', duration: 2500 })
      router.push('/dashboard?upgraded=true')
    } else {
      throw new Error(result.error)
    }
  }

  // Razorpay path (web / iOS PWA / desktop) — Stripe barely supports
  // India-domestic INR recurring under RBI mandate rules, so this replaces
  // it for all new web checkouts (existing Stripe subscribers are
  // untouched — see migration 022_razorpay_billing.sql). Opens Razorpay's
  // Checkout widget rather than redirecting, since subscriptions are
  // authorised in-modal, not via a hosted page like Stripe Checkout.
  const startRazorpayCheckout = (plan: 'monthly' | 'annual') =>
    new Promise<void>((resolve, reject) => {
      fetch('/api/razorpay/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
        .then(async (res) => {
          const data = await res.json()
          if (!res.ok) throw new Error(data.error)
          if (typeof window.Razorpay !== 'function') throw new Error('Payment widget failed to load — please retry.')

          const rzp = new window.Razorpay({
            key: data.key_id,
            subscription_id: data.subscription_id,
            name: 'GetInShape',
            description: plan === 'monthly' ? 'Pro Monthly' : 'Pro Annual',
            prefill: { email: user?.email ?? undefined },
            // Razorpay's widget renders outside our DOM (its own iframe/modal), so it
            // can't read var(--brand) — read the live computed value instead so the
            // widget matches the active light/dark theme rather than one hardcoded hex.
            theme: { color: getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#F1662E' }, // token-check-ignore
            handler: (response) => {
              fetch('/api/razorpay/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...response, plan }),
              })
                .then(async (verifyRes) => {
                  const verifyData = await verifyRes.json()
                  if (!verifyRes.ok) throw new Error(verifyData.error)
                  queryClient.invalidateQueries({ queryKey: ['subscription', user?.id] })
                  toast({ title: 'Welcome to Pro!', duration: 2500 })
                  router.push('/dashboard?upgraded=true')
                  resolve()
                })
                .catch(reject)
            },
            modal: { ondismiss: () => reject(new Error('Checkout cancelled')) },
          })
          rzp.open()
        })
        .catch(reject)
    })

  const startCheckout = async (plan: 'monthly' | 'annual') => {
    if (loading) return
    setLoading(plan)
    try {
      if (playAvailable) await startPlayPurchase(plan)
      else await startRazorpayCheckout(plan)
    } catch (err) {
      const message = (err as Error).message
      if (message !== 'Checkout cancelled') {
        toast({ title: 'Checkout failed', description: message, variant: 'error' })
      }
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <div className="mx-auto w-full max-w-lg px-4 py-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>

        {/* Contextual banner from gating (Suspense-wrapped because it reads URL params) */}
        <Suspense fallback={null}>
          <ReasonBanner />
        </Suspense>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft border border-hairline px-3 py-1 text-xs font-semibold text-brand-ink mb-3">
            <Crown className="h-3.5 w-3.5" />
            GetInShape Pro
          </div>
          <h1 className="font-display text-3xl font-bold text-ink">Upgrade to Pro</h1>
          <p className="mt-2 text-sm text-ink-2">Log freely. Get deeper insights when you&apos;re ready.</p>
          <p className="mt-1.5 text-xs font-semibold text-brand-ink">Founder pricing — lock in ₹699/year while we&apos;re new.</p>
          {projection && profile && (
            <p className="mt-2 text-[13px] text-ink-2">
              You&apos;re on track for <span className="font-semibold text-ink">{profile.target_weight_kg} kg by ~{formatGoalDate(projection.date)}</span> — see your full curve with Pro.
            </p>
          )}
        </div>

        {/* Features */}
        <div className="rounded-sheet border border-hairline bg-surface p-5 mb-6 shadow-rest">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-brand" />
            <p className="text-sm font-bold text-ink">What you get with Pro</p>
          </div>
          <ul className="space-y-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-ink-2">
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-soft">
                  <Check className="h-3 w-3 text-brand" />
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
              className={`rounded-sheet border p-5 transition-all ${
                plan.highlight
                  ? 'border-2 border-brand bg-brand-soft shadow-float'
                  : 'border-hairline bg-surface shadow-rest'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-2">{plan.title}</p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-display text-3xl font-bold text-ink tabular-nums">
                      {playPrices[PLAY_PRODUCT_FOR_PLAN[plan.id]] ?? plan.price}
                    </span>
                    <span className="text-sm text-ink-2">{plan.per}</span>
                  </div>
                  <p className="text-xs text-ink-2 mt-0.5">{plan.note}</p>
                </div>
                {plan.badge && (
                  <span className="rounded-full bg-energy px-2.5 py-1 text-xs font-bold text-energy-ink">
                    {plan.badge}
                  </span>
                )}
              </div>
              <Button
                variant={plan.highlight ? 'default' : 'outline'}
                size="lg"
                className="mt-4 w-full rounded-full tap-scale"
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
          <p className="text-xs text-ink-2">
            {playAvailable
              ? 'Billed securely through Google Play · Cancel anytime'
              : 'Secured by Razorpay · Cancel anytime · 30-day money back'}
          </p>
          <div className="flex justify-center gap-4 text-xs text-ink-2">
            <Link href="/terms" className="underline hover:text-ink">Terms</Link>
            <Link href="/privacy" className="underline hover:text-ink">Privacy</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
